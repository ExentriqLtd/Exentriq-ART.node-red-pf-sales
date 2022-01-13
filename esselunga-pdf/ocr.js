const path = require('path');
const { createWorker } = require('tesseract.js');

const recognizeText = async (bitmapBuffer) => {

  try {
    const worker = createWorker({
      langPath: path.join(__dirname, 'lang')
    });
  
    await worker.load();
    await worker.loadLanguage('ita');
    await worker.initialize('ita');
    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '72'
    });

    const { data: { text } } = await worker.recognize(bitmapBuffer);
    await worker.terminate();
    return text;

  } catch (error) {
    throw(error);
  }

};

module.exports = {
  recognizeText
};