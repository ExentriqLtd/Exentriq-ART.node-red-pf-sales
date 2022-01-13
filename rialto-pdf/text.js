const CHAR_WIDTH = 5.4;

const ORDER_COLUMNS = {
  order: {
    number: [9, 17],
    date: [22, 30]
  },
  destination: {
    address: [21, 71]
  },
  delivery: {
    delivery: [15, 23],
    from: [34, 39],
    to: [49, 53]
  },
  product: {
    customerCode: [0, 10],
    code: [11, 21],
    description: [22, 47],
    unitOfMeasure: [48, 49],
    size:[50, 56],
    boxItems: [57, 59],
    boxes: [60, 65],
    gifts: [66, 71],
    cost: [72, 81],
    date: [82, 91]
  }
};

const expandSpaces = (width) => {
  const count = Math.round(parseFloat(width.toFixed(2)) / CHAR_WIDTH);
  return ' '.repeat(count);
};

const getRows = (chunks) => {

  let row = '';
  const rows = chunks.reduce((acc, obj) => {
    if (obj.str === ' ') {
      row += expandSpaces(obj.width);
    } else {
      row += obj.str;
    }
    if (obj.hasEOL) {
      acc.push(row);
      row = '';
    }
    return acc;
  }, []);
  return rows;
};

const getParsedObject = (row, objectColumns) => {

  const parsedObject = {};
  for (const prop of Object.keys(objectColumns)) {
    const [ start, end ] = objectColumns[prop];
    const value = row.slice(start, end).trim();
    parsedObject[prop] = value;
  }
  return parsedObject;
};

const getDateFromString = (dateString) => {

  try {
    const match = dateString.match(/(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{2})/);
    if (match) {
      const parsedDate = {
        day:  parseInt(match.groups.day),
        month: parseInt(match.groups.month),
        year: parseInt(match.groups.year) + 2000
      };
      return new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day, 10, 00).toISOString().slice(0, 10);
    }
  } catch (error) {
    throw ('Invalid date');
  }
};

const getTimeFromString = (timeString) => {
  try {
    const match = timeString.match(/(?<hour>\d{1,2}):(?<minute>\d{2})/);
    if (match) {
      return `${match.groups.hour.padStart(2, 0)}:${match.groups.minute.padStart(2, 0)}`;
    }
  } catch (error) {
    throw ('Invalid time');
  }
};

const analyzeOrder = (items, products, filename) => {

  const order = {
    customer: 'Rialto',
    anomalies: [],
    number: null,
    overrides: false,
    date: null,
    delivery: null,
    destinations: [
      {
        address: null,
        from: null,
        to: null,
        products: []
      }
    ],
    totals: {
      boxes: 0,
      items: 0
    }
  };

  const orderRowStart = items.findIndex(x => x.str.startsWith('Ordine n.'));
  const destinationStart = items.findIndex(x => x.str.startsWith('Destinatario merce :'));
  const deliveryRowStart = items.findIndex(x => x.str.startsWith('Data consegna:'));
  const deliveryRowEnd = items.findIndex(x => x.str.startsWith('Contatti:'));
  const productTableStart = items.findIndex(x => x.hasEOL && x.str === '-'.repeat(132)) + 1;
  const productTableEnd = items.findIndex(x => x.hasEOL && x.str === '**** FINE ORDINE ****') - 3;

  if (orderRowStart > -1 && destinationStart > -1) {
    const orderRow = getRows(items.slice(orderRowStart, destinationStart))[0];
    const { number, date } = getParsedObject(orderRow, ORDER_COLUMNS.order);
    order.number = number;
    try {      
      order.date = getDateFromString(date);  
    } catch (error) {
      order.anomalies.push('Order date is not valid');
    }
  } else {
    order.anomalies.push('Order number and date not recognized');
  }

  if (destinationStart > -1 && deliveryRowStart > -1) {
    const destinationRow = getRows(items.slice(destinationStart, deliveryRowStart))[0];
    const { address } = getParsedObject(destinationRow, ORDER_COLUMNS.destination)
    order.destinations[0].address = address.replace('CARPRANO', 'CARPIANO');  
  } else {
    order.anomalies.push('Destination not found');
  }

  if (deliveryRowStart > -1 && deliveryRowEnd > -1) {
    const deliveryRow = getRows(items.slice(deliveryRowStart, deliveryRowEnd))[0];
    const { delivery, from, to } = getParsedObject(deliveryRow, ORDER_COLUMNS.delivery);
    try {
      order.delivery = getDateFromString(delivery);      
    } catch (error) {
      order.anomalies.push('Delivery date is not valid');
    }
    order.destinations[0].from = getTimeFromString(from);
    order.destinations[0].to = getTimeFromString(to);  
  } else {
    order.anomalies.push('Delivery date not found');
  }

  if (productTableStart > -1 && productTableEnd > -1) {
    const productRows = items.slice(productTableStart, productTableEnd);
    for (const productRow of getRows(productRows)) {
      const parsedProduct = getParsedObject(productRow, ORDER_COLUMNS.product);
      const matchingProduct = products.find(x => x.customer_code === parsedProduct.customerCode);
      if (matchingProduct) {
        const product = {
          customer_code: matchingProduct.customer_code,
          code: matchingProduct.code,
          ean: matchingProduct.ean,
          description: matchingProduct.description,
          boxes: parseInt(parsedProduct.boxes),
        };
        product.items = product.boxes * matchingProduct.boxItems;
        order.destinations[0].products.push(product);
        order.totals.boxes += product.boxes;
        order.totals.items += product.items
      }
    }  
  } else {
    order.anomalies.push('Product table not found');
  }

  return order;
};

const analyzeConfirmation = (items, products, filename) => {

  const confirmation = {
    customer: 'Ortofin',
    anomalies: [],
    date: null,
    order: null,
    shipping: {
      code: null,
      date: null
    },
    products: [],
    totals: {
      boxes: 0,
      items: 0,
      cost: 0
    }
  };

  return confirmation;
};

const documentTypes = [
  {
    name: 'order',
    needle: 'Ordine n.',
    analyzer: analyzeOrder
  },
  {
    name: 'confirmation',
    needle: 'Riscontro n.',  // ??? to be confirmed
    analyzer: analyzeConfirmation
  }
];

const analyzeText = (text, products, filename = null) => {

  try {

    let result = {
      documentType: 'unknown',
      content: undefined
    };

    for (const documentType of documentTypes) {
      if (text.items.filter(x => x.str.startsWith(documentType.needle)).length === 1) {
        result = {
          documentType: documentType.name,
          content: documentType.analyzer(text.items, products, filename)
        };
        break;
      }
    }
  
    return result;
  
  } catch (error) {
    throw(error);
  }

};

module.exports = {
  analyzeText
};
