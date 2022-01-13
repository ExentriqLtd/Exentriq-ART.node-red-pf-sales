const levenshtein = require('js-levenshtein');

const ambiguousChars = '6890/B';

const regexes = {
  order: {
    number: /TRASMETTIAMO NOSTRO ORDINE DI ACQUISTO\s*(?<number>\w\/[\d\/B]*) DEL/,
    overrides: /ATTENZIONE: IL PRESENTE ORDINE DEL .* SOSTITUISCE IL\nPRECEDENTE INVIATO IL .* CON IL MEDESIMO CODICE/,
    date: /TRASMETTIAMO NOSTRO ORDINE DI ACQUISTO\s*.*DEL\s*(?<day>[\d\/B]{2})\/(?<month>[\d\/B]{2})\/(?<year>[\d\/B]{4})/,
    destination: /^(?<address>.*)$\n^ATTENZIONE: IL NOSTRO/m,
    delivery: /CONSEGNARE TASSATIVAMENTE IL (?<day>[\d\/B]{1,2})\/(?<month>[\d\/B]{1,2})\/(?<year>[\d\/B]{1,2})/,
    warehouse: /IL NOSTRO MAGAZZINO RICEVE MERCI DALLE (?<fromHour>[\d\/B]{1,2})\.(?<fromMinute>[\d\/B]{1,2}) ALLE (?<toHour>[\d\/B]{1,2})\.(?<toMinute>[\d\/B]{1,2})/,
    products: /(?<code>[\d\/B]{6,})\s*(?<description>[\w\s]*G)\s*(?<quantity>[\d\/B]*)\s*(?<cost>[\d\/B\,\s]*)\n/g,
    boxCount: /TOTALE COLL[IT]\s*(?<count>[\d\/B]*)/
  },
  confirmation: {
    number: /ORDINE NR. (?<number>\w\/[\d\/B]*)/,
    products: /(?<code>[\d\/B]{6,})\s*(?<description>[\w\s]*?G*)\s*(?<boxes>[\d\/B]*)\s*(?<items>[\d\/B\.]*)\s{5,}(?<unitCost>[\d\/B]{1,2},\s{0,1}[\d\/B]{2,})\s*(?<totalCost>[\d\/B\.]*,\s{0,1}[\d\/B]{3,})/g,
    totals: /\n(?<boxTotal>[\d\/B]*)\s{1,}(?<itemTotal>[\d\/B\.]*)\s{5,}(?<costTotal>[\d\.\/B]*,\/{0,1}\s{0,1}[\d\/B]{2,})\nSi prega di verificare/,
    date: /Distinti saluti\nLimito di Pioltello, (?<day>[\d\/B]{2,})\s*(?<month>\w*)\s*(?<year>[\d\/B]{4})/
  }
};

const months = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

const getDateFromObject = (objectDate) => {

  try {
    return new Date(objectDate.year + (objectDate.year < 2000 ? 2000 : 0), objectDate.month - 1, objectDate.day, 10, 00).toISOString().slice(0, 10);
  } catch (error) {
    throw ('Invalid date');
  }

};

const fixDatePart = (datePart) => {

  if (datePart === 109 || datePart === 106) {
    datePart = 10;
  }
  if (datePart === 209 || datePart === 206) {
    datePart = 20;
  }
  if (datePart === 309 || datePart === 306) {
    datePart = 30;
  }
  if (datePart > 90 && datePart < 100) {
    datePart -= 90;
  }
  if (datePart > 80 && datePart < 90) {
    datePart -= 80;
  }
  if (datePart > 60 && datePart < 70) {
    datePart -= 60;
  }

  return datePart;

};

const findMatchingProduct = (code, products) => {
  let score = 999;
  let matchingProduct;
  for (const product of products) {
    const distance = levenshtein(code, product.customer_code);
    if (distance < score) {
      matchingProduct = product;
      score = distance;
    }
  }
  return matchingProduct;
};

// const findFirstDifference = (str1, str2) =>
//   str2[[...str1].findIndex((el, index) => el !== str2[index])];

const findFirstDifference = (str1, str2) => {
  const index = [...str1].findIndex(function(el, index) {
    return el !== str2[index]
  });

  if (index !== undefined) {
    return {
      char: str2[index],
      index
    }
  }
};

const fixNumber = (number, estimate) => {

  let numberString = number.toFixed(2);
  let estimateString = estimate.toFixed(2);

  const iterations = Math.abs(numberString.length - estimateString.length);

  for (let i = 0; i < iterations; i++) {
    let diff = findFirstDifference(estimateString, numberString);
    if (diff) {
      let a = numberString.split('');
      a.splice(diff.index, 1);
      numberString = a.join('');
    }
  }

  for (let i = 0; i < levenshtein(numberString, estimateString); i++) {
    let diff = findFirstDifference(estimateString, numberString);
    if (diff && ambiguousChars.indexOf(diff.char) > -1) {
      const a = numberString.split('');
      a[diff.index] = estimateString[diff.index];
      numberString = a.join('');
    }
  }

  return numberString === estimateString ? parseFloat(estimateString) : null;
};


const analyzeOrder = (options) => {

  const order = {
    customer: 'Esselunga',
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

  const { text, products, orderNumber } = options;
  
  let match;
  let boxes = 0;

  if (orderNumber) {
    order.number = orderNumber;
  } else {
    match = text.match(regexes.order.number);
    if (match) {
      order.number = match.groups.number;
    } else {
      order.anomalies.push('Order number not recognized');
    }  
  }

  match = text.match(regexes.order.overrides);
  order.overrides = match ? true : false;

  match = text.match(regexes.order.date);
  if (match) {
    const orderDate = {
      day:  parseInt(match.groups.day),
      month: parseInt(match.groups.month),
      year: parseInt(match.groups.year)
    };

    orderDate.day = fixDatePart(orderDate.day);
    orderDate.month = fixDatePart(orderDate.month);

    try {
      order.date = getDateFromObject(orderDate);
    } catch (error) {
      order.anomalies.push('Order date is not valid');
    }
  } else {
    order.anomalies.push('Order date not recognized');
  }

  match = text.match(regexes.order.destination);
  if (match) {
    order.destinations[0].address = match.groups.address.replace(/\s{2,}/g, ' ');
  } else {
    oreder.anomalies.push('Destination address not recognized');
  }

  match = text.match(regexes.order.boxCount);
  if (match) {
    boxes = parseInt(match.groups.count.replace('.', ''));
  } else {
    order.anomalies.push('Total box count not recognized');
  }

  match = text.match(regexes.order.delivery);
  if (match) {
    const deliveryDate = {
      day:  parseInt(match.groups.day),
      month: parseInt(match.groups.month),
      year: parseInt(match.groups.year)
    };
    try {
      order.delivery = getDateFromObject(deliveryDate);
    } catch (error) {
      order.anomalies.push('Delivery date is not valid');
    }
  } else {
    order.anomalies.push('Delivery date not recognized');
  }

  match = text.match(regexes.order.warehouse);
  if (match) {
    order.destinations[0].from = `${match.groups.fromHour}:${match.groups.fromMinute}`;
    order.destinations[0].to = `${match.groups.toHour}:${match.groups.toMinute}`;
  } else {
    order.anomalies.push('Warehouse opening hours not recognized');
  }

  let matches = [];

  // String.prototype.matchAll() is only available since Node.js v12.0.0
  if (typeof String.prototype.matchAll === 'function') {
    matches = [...text.matchAll(regexes.order.products)];
  } else {
    let m;
    do {
      m = regexes.order.products.exec(text);
      if (m) {
        matches.push(m);
      }
    } while (m);  
  }

  if (matches.length > 0) {
    for (const match of matches) {

      const code = match.groups.code.trim();
      const matchingProduct = products.find(x => x.customer_code === code);

      if (matchingProduct) {
        const orderProduct = {
          code: matchingProduct.code,
          ean: matchingProduct.ean,
          customer_code: matchingProduct.customer_code,
          description: matchingProduct.description,
          boxes: parseInt(match.groups.quantity.replace('.', '')),
        };
        orderProduct.items = orderProduct.boxes * matchingProduct.boxItems;
        order.destinations[0].products.push(orderProduct);
        order.totals.boxes += orderProduct.boxes
        order.totals.items += orderProduct.items;
      } else {
        order.anomalies.push(`Product code ${code} not found`);
      }
    }
  } else {
    order.anomalies.push('Products not recognized');
  }
    
  if (order.totals.boxes !== boxes) {
    if (!fixNumber(boxes, order.totals.boxes)) {
      order.anomalies.push(`Calculated box count (${order.totals.boxes}) is different from the read box count (${boxes})`);
    }
  }

  return order;
};

const analyzeConfirmation = (options) => {

  const confirmation = {
    customer: 'Esselunga',
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

  const { text, products, orderNumber } = options;

  let match;

  if (orderNumber) {
    confirmation.order = orderNumber;
  } else {
    match = text.match(regexes.confirmation.number);
    if (match) {
      confirmation.order = match.groups.number;
    } else {
      confirmation.anomalies.push('Order number not recognized');
    }  
  }
  

  match = text.match(regexes.confirmation.date);
  if (match) {
    const confirmationDate = {
      day:  parseInt(match.groups.day),
      month: months.indexOf(match.groups.month.toLowerCase()) + 1,
      year: parseInt(match.groups.year)
    };

    confirmationDate.day = fixDatePart(confirmationDate.day);
    confirmationDate.month = fixDatePart(confirmationDate.month);

    try {
      confirmation.date = getDateFromObject(confirmationDate);
    } catch (error) {
      confirmation.anomalies.push('Confirmation date is not valid');
    }
  } else {
    confirmation.anomalies.push('Confirmation date not recognized');
  }

  let matches = [];

  // String.prototype.matchAll() is only available since Node.js v12.0.0
  if (typeof String.prototype.matchAll === 'function') {
    matches = [...text.matchAll(regexes.confirmation.products)];
  } else {
    let m;
    do {
      m = regexes.confirmation.products.exec(text);
      if (m) {
        matches.push(m);
      }
    } while (m);  
  }

  if (matches.length > 0) {
    for (const match of matches) {
      const product = {
        customer_code: match.groups.code.trim(),
        description: match.groups.description.trim(),
        boxes: parseInt(match.groups.boxes.replace('.', '')),
        items: parseInt(match.groups.items.replace('.', '')),
        unit_cost: parseFloat(match.groups.unitCost.replace(/\s*/g, '').replace(',', '.').replace('B', '0').replace('/', '7')),
        total_cost: parseFloat(match.groups.totalCost.replace(/\s*/g, '').replace('.', '').replace(',', '.').replace('B', '0').replace('/', '7'))
      };

      if (product.total_cost.toFixed(2) !== (product.items * product.unit_cost).toFixed(2)) {

        const fixedTotalCost = fixNumber(
          parseFloat(product.total_cost.toFixed(2)),
          parseFloat((product.items * product.unit_cost).toFixed(2))
        );

        if (fixedTotalCost) {
          product.total_cost = fixedTotalCost;
        } else {
          const fixedItems = fixNumber(
            parseInt(product.items),
            parseInt(product.total_cost / product.unit_cost)
          );

          if (fixedItems) {
            product.items = fixedItems;
          }
        }

      }

      if (product.customer_code) {
        const matchingProduct = findMatchingProduct(product.customer_code, products);
        product.code = matchingProduct.code;
        product.customer_code = matchingProduct.customer_code;
        product.ean = matchingProduct.ean;
        product.description = matchingProduct.description;
        product.boxItems = matchingProduct.boxItems;

        if (product.items !== product.boxes * matchingProduct.boxItems) {
          confirmation.anomalies.push(`Product "${product.description}": item count (${product.items}) is not equal to box count (${product.boxes}) multiplied by ${matchingProduct.boxItems}`);
        }

      }
      confirmation.products.push(product);
    }
  } else {
    confirmation.anomalies.push('Products not recognized');
  }

  match = text.match(regexes.confirmation.totals);
  if (match) {
    confirmation.totals.boxes = parseInt(match.groups.boxTotal.replace('.', ''));
    confirmation.totals.items = parseInt(match.groups.itemTotal.replace('.', ''));
    confirmation.totals.cost = parseFloat(match.groups.costTotal.replace(/\s*/g, '').replace('.', '').replace(',', '.').replace('B', '0').replace('/', '7'));
  } else {
    confirmation.anomalies.push('Totals not recognized');
  }

  // Perform some checks...

  let boxes = 0;
  let items = 0;
  let cost = 0;

  for (const product of confirmation.products) {
    if (product.items !== product.boxItems * product.boxes) {
      confirmation.anomalies.push(`Product "${product.description}": number of items (${product.items}) is not equal to number of boxes (${product.boxes}) multiplied by ${product.boxItems}`);
    }

    delete product.boxItems;

    if ((product.items * product.unit_cost).toFixed(2) !== product.total_cost.toFixed(2)) {

      let fixed = false;

      if (Math.abs(product.items * product.unit_cost - product.total_cost) < 0.01) {
        product.total_cost = product.items * product.unit_cost;
        fixed = true;
      } else {
        const calculatedUnitCost = product.total_cost / product.items;

        const fixedUnitCost = fixNumber(product.unit_cost, calculatedUnitCost);
        if (fixedUnitCost) {
          product.unit_cost = fixedUnitCost;
          fixed = true;
        }
      }


      if (!fixed) {
        confirmation.anomalies.push(`Product "${product.description}": total cost (€ ${product.total_cost}) is not equal to number of items (${product.items}) multiplied by unit cost (€ ${product.unit_cost})`);
      }
    }

    boxes += product.boxes;
    items += product.items;
    cost += product.total_cost;
  }

  if (boxes !== confirmation.totals.boxes) {
    const fixedBoxes = fixNumber(confirmation.totals.boxes, boxes);
    if (fixedBoxes) {
      confirmation.totals.boxes = fixedBoxes;
    } else {
      confirmation.anomalies.push(`Box total (${confirmation.totals.boxes}) is not equal to the sum of boxes of products (${boxes})`);
    }
  }

  if (items !== confirmation.totals.items) {
    const fixedItems = fixNumber(confirmation.totals.items, items);
    if (fixedItems) {
      confirmation.totals.items = fixedItems;
    } else {
      confirmation.anomalies.push(`Item total (${confirmation.totals.items}) is not equal to the sum of items of products (${items})`);
    }
  }


  if (cost.toFixed(2) !== confirmation.totals.cost.toFixed(2)) {
    let fixed = false;
    if (Math.abs(cost - confirmation.totals.cost) < 0.01) {
      confirmation.totals.cost = parseFloat(cost.toFixed(2));
      fixed = true;
    } else {
      const fixedTotalCost = fixNumber(
        parseFloat(confirmation.totals.cost.toFixed(2)),
        parseFloat(cost.toFixed(2))
      );
      if (fixedTotalCost) {
        confirmation.totals.cost = fixedTotalCost;
        fixed = true;
      }
    }
    if (!fixed) {
      confirmation.anomalies.push(`Total cost (€ ${confirmation.totals.cost}) is not equal to the sum of costs of products (€ ${cost})`)
    }
  }

  return confirmation;

};

const documentTypeObjects = [
  {
    name: 'order',
    needle: /TRASMETTIAMO NOSTRO ORDINE DI ACQUISTO/,
    analyzer: analyzeOrder
  },
  {
    name: 'confirmation',
    needle: /Conferma ricezione merce/,
    analyzer: analyzeConfirmation
  }
];

const analyzeText = (options) => {

  let analyzer;

  let documentType = options.documentType ? options.documentType : null;

  if (documentType) {
    analyzer = documentTypeObjects.find(x => x.name === documentType).analyzer;
  } else {
    for (const documentTypeObject of documentTypeObjects) {
      if (options.text.search(documentTypeObject.needle) > -1) {
        documentType = documentTypeObject.name;
        analyzer = documentTypeObject.analyzer;
        break;
      }
    }  
  }

  options.documentType = documentType;

  return {
    documentType,
    content: analyzer(options)
  };



  return result;

};

module.exports = {
  analyzeText
};
