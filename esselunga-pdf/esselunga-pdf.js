module.exports = function(RED) {

  const { extractBitmapBuffer } = require('./bitmap.js');
  const { recognizeText } = require('./ocr.js');
  const { analyzeText } = require('./text.js');

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

  const getDetailsFromSubject = (subject) => {

    const result = {
      documentType: null,
      orderNumber: null
    };

    const documentTypeObjects = [
      {
        name: 'order',
        regex: /\d*\s{5}(?<orderNumber>\d*) PLANET FARMS ITALIA SOCIE S24 (?<orderPrefix>\w{1})\w{1} MSG: .*/
      },
      {
        name: 'confirmation',
        regex: /\d*\s{2}(?<orderNumber>\d*) PLANET FARMS S24 (?<orderPrefix>\w{1})\. MSG: .*/,
      }
    ];

    for (const documentTypeObject of documentTypeObjects) {
      const m = documentTypeObject.regex.exec(subject);
      if (m) {
        result.documentType = documentTypeObjects.name;
        result.orderNumber = `${m.groups.orderPrefix}/${m.groups.orderNumber}`;
        break;
      }
    }
    return result;
  };

  const processPDF = async (options) => {

    try {

      const bitmapBuffer = await extractBitmapBuffer(options.pdf);
      const text = await recognizeText(bitmapBuffer);
      delete options.pdf;
      const { documentType, content } = analyzeText({ text, ...options });
  
      return {
        text,
        documentType,
        content
      };
        
    } catch (error) {
      throw(error);
    }

  
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

  function EsselungaPDFNode(config) {
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
            pdf: msg.payload,
            subject: msg.subject,
            date: msg.date,
            messageID: msg.messageID
          });

          setNodeStatus(node);

          if (context.status !== Status.PROCESSING) {
  
            while (context.queue.length > 0) {

              const { pdf, subject, date, messageID } = context.queue.shift();

              const { documentType, orderNumber } = getDetailsFromSubject(subject);

              context.status = Status.PROCESSING;
              setNodeStatus(node);
              const result = await processPDF({
                pdf,
                products,
                documentType,
                orderNumber
              });

              send({
                recognizedText: result.text,
                documentType: result.documentType,
                payload: result.content,
                date,
                messageID
              });
  
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

  RED.nodes.registerType('esselunga-pdf', EsselungaPDFNode);
}
