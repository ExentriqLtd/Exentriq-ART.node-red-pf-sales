const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const extractTextFromPDF = async (pdfData) => {

  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData, verbosity: 0 });
    const pdfDocument = await loadingTask.promise;
    const pdfPage = await pdfDocument.getPage(1);
    const text = await pdfPage.getTextContent();  
    return text;
  } catch (error) {
    throw(error)
  }

};

module.exports = {
  extractTextFromPDF
};
