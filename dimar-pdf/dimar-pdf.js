module.exports = function(RED) {

  const { extractTextFromPDF } = require('./extract.js');
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

  const processPDF = async (pdf, products, filename = null) => {

    try {

      const text = await extractTextFromPDF(pdf);
      const { documentType, content } = analyzeText(text, products, filename);

      if (content) {
        return {
          text,
          documentType,
          content
        };  
      } else {
        if (documentType === 'unknown') {
          throw(new Error('Document type not recognized'))
        } else {
          throw(new Error(`Document (${documentType}) cannot be analyzed`));
        }
      }
        
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

  function DimarPDFNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const context = node.context();
    context.queue = context.queue || [];
    context.status = context.queue.length === 0 ? Status.AVAILABLE : Status.PROCESSING;

    setNodeStatus(node);

    const products = JSON.parse(config.products);

    this.on('input', async (msg, send, done) => {
      if (msg.hasOwnProperty('payload')) {

        const filename = msg.hasOwnProperty('filename') ? msg.filename : null;

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

              context.status = Status.PROCESSING;
              setNodeStatus(node);
              const result = await processPDF(pdf, products, filename);

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

  RED.nodes.registerType('dimar-pdf', DimarPDFNode);
}
