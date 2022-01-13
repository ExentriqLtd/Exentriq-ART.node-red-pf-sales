module.exports = function(RED) {

  const { parseExcel } = require('./parse.js');

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

  const getDetailsFromSubject = (subject, date) => {

    const d = new Date(date);
    const regex = /Consegna\s*(?<deliveryDay>\d{2})-(?<deliveryMonth>\d{2})\s*Planet Farms(?:\s*N°\s*\d*_(?<orderNumber>\d*))?/;
    const details = {
      documentType: 'order',
      orderNumber: null,
      delivery: null
    };
    const match = subject.match(regex);
    if (match) {
      const { deliveryDay, deliveryMonth, orderNumber } = match.groups;
      details.delivery = new Date(d.getFullYear(), parseInt(deliveryMonth) - 1, parseInt(deliveryDay), 10, 0, 0).toISOString().slice(0, 10);
      details.orderNumber = orderNumber ? orderNumber : `Gorillas_${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    }
    return details;  
  };
  

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

  function GorillasXLSXNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const context = node.context();
    context.queue = context.queue || [];
    context.status = context.queue.length === 0 ? Status.AVAILABLE : Status.PROCESSING;

    setNodeStatus(node);

    const products = JSON.parse(config.products);
    const warehouses = JSON.parse(config.warehouses);

    this.on('input', async (msg, send, done) => {
      if (msg.hasOwnProperty('payload')) {

        const filename = msg.hasOwnProperty('filename') ? msg.filename : null;

        try {

          context.queue.push({
            xlsx: msg.payload,
            subject: msg.subject,
            date: msg.date,
            messageID: msg.messageID
          });

          setNodeStatus(node);

          if (context.status !== Status.PROCESSING) {
  
            while (context.queue.length > 0) {

              const { xlsx, subject, date, messageID } = context.queue.shift();

              context.status = Status.PROCESSING;
              setNodeStatus(node);

              const { documentType, orderNumber, delivery } = getDetailsFromSubject(subject, date);
              const order = await parseExcel(xlsx, products, warehouses, date);

              const document =  {
                documentType,
                date,
                messageID,
                payload: {
                  customer: 'Gorillas',
                  anomalies: [],
                  overrides: false,
                  number: orderNumber,
                  date: (new Date(date)).toISOString().slice(0, 10),
                  delivery,
                  destinations: [],
                  totals: order.totals
                }
              };

              for (const destination of order.destinations) {
                document.payload.destinations.push(destination);
              }

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

  RED.nodes.registerType('gorillas-xlsx', GorillasXLSXNode);
}
