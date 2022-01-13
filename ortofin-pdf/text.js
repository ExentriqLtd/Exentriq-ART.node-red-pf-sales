const getDateFromString = (stringDate) => {

  try {
    return new Date(parseInt(stringDate.slice(6, 10)), parseInt(stringDate.slice(3, 5)) - 1, parseInt(stringDate.slice(0, 2)), 10, 00).toISOString().slice(0, 10);
  } catch (error) {
    throw ('Invalid date');
  }

};

const getDateFromFilename = (filename) => {

  const chunks = filename.split('_');
  if (chunks.length === 3) {
    const stringDate = chunks[1];
    try {
      return new Date(parseInt(stringDate.slice(0, 4)), parseInt(stringDate.slice(4, 6)) - 1, parseInt(stringDate.slice(6, 8)), 10, 00).toISOString().slice(0, 10);
    } catch (error) {
      throw('Invalid date');
    }

  }
};

const analyzeOrder = (items, products, filename) => {

  const order = {
    customer: 'Ortofin',
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

  if (items.find(x => x.indexOf('Il Presente Annulla e Sostituisce il Precedente') > -1)) {
    order.overrides = true;
  }

  let index = items.indexOf('Origine');

  if (index > -1 && items[index + 1] === '') {

    for (const product of products) {

      const index = items.indexOf(product.customer_code);
      if (index > -1) {

        // sometimes "Imb" is missing...
        const offset = items[index + 3] === 'C212' ? 1 : 0;

        const orderProduct = {
          code: product.code,
          customer_code: product.customer_code,
          ean: product.ean,
          description: product.description,
          boxes: parseInt(items[index + 7 + offset]),
          items: parseInt(items[index + 4 + offset])
        }
        if (orderProduct.items !== orderProduct.boxes * product.boxItems) {
          order.anomalies.push(`Product "${product.description}": number of items (${orderProduct.items}) is not equal to number of boxes (${orderProduct.boxes}) multiplied by ${product.boxItems}`);
        }
        order.totals.boxes += orderProduct.boxes;
        order.totals.items += orderProduct.items;
        order.destinations[0].products.push(orderProduct);
      }
    }  
  } else {
    order.anomalies.push('Product table not recognized');
  }


  index = items.indexOf('Pag 1 di 1');
  if (index > -1) {
    order.number = items[index - 3];
    const orderDate = items[index - 2];
    try {
      order.date = getDateFromString(orderDate);
    } catch (error) {
      order.anomalies.push('Order date is not valid');
    }
    const deliveryDate = items[index - 1];
    try {
      order.delivery = getDateFromString(deliveryDate);
    } catch (error) {
      order.anomalies.push('Delivery date is not valid');
    }
    try {
      order.destinations[0].address = `${items[index + 3]}, ${items[index + 4]}`;      
    } catch (error) {
      order.anomalies.push('Destination not recognized');
    }
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

  if (filename) {
    confirmation.date = getDateFromFilename(filename);
  }

  for (const product of products) {
    const index = items.indexOf(product.customer_code);
    if (index > -1) {

      // sometimes "lotto" and "scadenza" are missing...
      let offset;
      if (items[index + 4] === 'C212') {
        offset = 0;
      } else if (items[index + 6] === 'C212') {
        offset = 2;
      } else {
        offset = 3;
      }

      const orderProduct = {
        code: product.code,
        customer_code: product.customer_code,
        ean: product.ean,
        description: product.description,
        boxes: parseInt(items[index + 6 + offset]),
        items: parseInt(items[index + 7 + offset]),
        unit_cost: parseFloat(items[index + 8 + offset].replace(',', '.'))
      }
      if (orderProduct.items !== orderProduct.boxes * product.boxItems) {
        confirmation.anomalies.push(`Product "${product.description}": number of items (${orderProduct.items}) is not equal to number of boxes (${orderProduct.boxes}) multiplied by ${product.boxItems}`);
      }
      orderProduct.total_cost = parseFloat((orderProduct.unit_cost * orderProduct.items).toFixed(4));
      confirmation.totals.boxes += orderProduct.boxes;
      confirmation.totals.items += orderProduct.items;
      confirmation.totals.cost += orderProduct.total_cost;
      confirmation.products.push(orderProduct);
    }
  }
  confirmation.totals.cost = parseFloat(confirmation.totals.cost.toFixed(4));

  const index = items.indexOf('Vostro D.D.T. di consegna numero');
  if (index > -1) {
    try {
      confirmation.shipping.code = items[index + 1];
    } catch (error) {
      confirmation.anomalies.push('Shipping code not recognized');
    }

    try {
      confirmation.shipping.date = getDateFromString(items[index + 2]);
    } catch (error) {
      confirmation.anomalies.push('Shipping date is not valid');
    }
  }


  return confirmation;
};

const documentTypes = [
  {
    name: 'order',
    needle: 'ORDINE D\'ACQUISTO',
    analyzer: analyzeOrder
  },
  {
    name: 'confirmation',
    needle: 'RISCONTRO D.D.T.',
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
          content: documentType.analyzer(text.items.map(x => x.str.trim()), products, filename)
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
