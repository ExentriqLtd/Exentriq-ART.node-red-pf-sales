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

  const getDetailsFromSubject = (subject, warehouses) => {

    const regex = /Glovo Purchase Order Planet Farms (?<orderMonth>\d{1,2})\/(?<orderDay>\d{1,2})\/(?<orderYear>\d{4}) \((?<warehouse>[\w\s]*)\)/;
    const details = {
      documentType: 'order',
      orderNumber: null,
      orderDate: null,
      delivery: null,
      warehouse: null
    };
    const match = subject.match(regex);
    if (match) {
      const { orderDay, orderMonth, orderYear, warehouse } = match.groups;

      const orderDate = new Date(parseInt(orderYear), parseInt(orderMonth) - 1, parseInt(orderDay), 10, 0);
      let deliveryDate = new Date(orderDate);
      deliveryDate.setDate(deliveryDate.getDate() + 1);

      details.orderDate = orderDate.toISOString().slice(0, 10);
      details.delivery = deliveryDate.toISOString().slice(0, 10);

      details.orderNumber = `Glovo_${orderDate.getFullYear()}${(orderDate.getMonth() + 1).toString().padStart(2, '0')}${orderDate.getDate().toString().padStart(2, '0')}`;

      const matchingWarehouse = warehouses.find(x => x.name.toUpperCase() === warehouse.toUpperCase());
      if (matchingWarehouse) {
        details.warehouse = {
          address: matchingWarehouse.address,
          from: matchingWarehouse.from,
          to: matchingWarehouse.to
        };
        details.orderNumber += `_${warehouse.toUpperCase().replace(' ', '_')}`;
      }

      
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

  function GlovoXLSXNode(config) {
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

              const { documentType, orderNumber, orderDate, delivery, warehouse } = getDetailsFromSubject(subject, warehouses);
              const order = await parseExcel(xlsx, products, warehouse);

              const document =  {
                documentType,
                date,
                messageID,
                payload: {
                  customer: 'Glovo',
                  anomalies: [],
                  overrides: false,
                  number: orderNumber,
                  date: (new Date(orderDate)).toISOString().slice(0, 10),
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

  RED.nodes.registerType('glovo-xlsx', GlovoXLSXNode);
}
