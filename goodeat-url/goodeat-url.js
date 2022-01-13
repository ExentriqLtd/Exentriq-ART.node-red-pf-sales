const { retrieveOrder } = require("./retrieve");

module.exports = function(RED) {

  /**
   * Enum for status.
   * @readonly
   * @enum {{text: string, fill: string, shape: string}}
   */
   const Status = Object.freeze({
    AVAILABLE: { text: 'available', fill: 'green', shape: 'dot' },
    PROCESSING: { text: 'processing', fill: 'yellow', shape: 'ring' },
    ERROR: { text: 'error', fill: 'red', shape: 'dot' }
  });


  const setNodeStatus = (node) => {

    const context = node.context();
    let { text, fill, shape } = context.status;
    
    if (context.queue.length > 0) {
      text += ` - ${context.queue.length} waiting`;
    }

    node.status({
      text,
      fill,
      shape
    });

  };

  function GoodeatURLNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const context = node.context();
    context.queue = context.queue || [];
    context.status = context.queue.length === 0 ? Status.AVAILABLE : Status.PROCESSING;

    setNodeStatus(node);

    const products = JSON.parse(config.products);

    this.on('input', async (msg, send, done) => {
      if (msg.hasOwnProperty('payload')) {

        try {
          context.queue.push({
            body: msg.payload,
            subject: msg.subject,
            date: msg.date,
            messageID: msg.messageID
          });

          setNodeStatus(node);

          if (context.status !== Status.PROCESSING) {
  
            while (context.queue.length > 0) {

              const { body, subject, date, messageID } = context.queue.shift();

              context.status = Status.PROCESSING;
              setNodeStatus(node);

              const order = await retrieveOrder(body, products);
              const document =  {
                documentType: 'order',
                date,
                messageID,
                payload: {
                  customer: 'Goodeat',
                  anomalies: order.anomalies,
                  overrides: order.overrides,
                  number: order.number,
                  date: (new Date(order.date)).toISOString().slice(0, 10),
                  delivery: order.delivery,
                  destinations: order.destinations,
                  totals: order.totals
                }
              };

              send(document);

            }
            context.status = Status.AVAILABLE;
            setNodeStatus(node);
          }
        } catch (error) {
          if (done) {
            context.status = Status.ERROR;
            setNodeStatus(node);
            done(error);
          } else {
            node.error(err, msg);
          }
        }

        if (done) {
          done();
        }
      }
    });
  }

  RED.nodes.registerType('goodeat-url', GoodeatURLNode);
}
