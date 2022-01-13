const isItemInsidePDFBox = (item, pdfBox) => {
  return (
    (item.transform[4] > pdfBox[0] && item.transform[4] < pdfBox[2])
    && (item.transform[5] > pdfBox[1] && item.transform[5] < pdfBox[3])
  );
};

const getRows = (chunks) => {

  let row = [];
  const rows = chunks.reduce((acc, obj) => {
    row.push({ str: obj.str, pos: obj.transform[4]});
    if (obj.hasEOL) {
      row.sort((a, b) => {
        return a.pos - b.pos;
      });
      acc.push(row.map(x => x.str).join(''));
      row = [];
    }
    return acc;
  }, []);
  return rows;
};

const getDateFromParts = (day, month, year) => {
  try {
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 10, 00).toISOString().slice(0, 10);
  } catch (error) {
    throw ('Invalid date');
  }
};

const getDateFromFilename = (filename) => {

  const chunks = filename.split(' ');
  if (chunks.length === 4) {
    const stringParts = chunks[3].split('-');
    try {
      return getDateFromParts(stringParts[0], stringParts[1], stringParts[2]);
    } catch (error) {
      throw('Invalid date');
    }

  }
};

const analyzeOrder = (text, products, filename) => {

  const pdfBoxes = {
    delivery: (items) => {
      const coords = [221.10, 397.60, 313.75, 414.85];
      const regex = /(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{4})/;
      try {
        const stringDate = items.filter(x => isItemInsidePDFBox(x, coords)).filter(x => x.str.trim() !== '')[0].str;
        const match = stringDate.match(regex);
        if (match) {
          return getDateFromParts(match.groups.day, match.groups.month, match.groups.year);  
        } else {
          throw('');
        }  
      } catch (error) {
        return null;          
      }
    },
    schedule: (items) => {
      const coords = [313.75, 397.60, 504.05, 414.85];
      const regex = /(?<fromHour>\d{1,2}):(?<fromMinute>\d{2})\s*-\s*(?<toHour>\d{1,2}):(?<toMinute>\d{2})/;
      try {
        const scheduleString = items.filter(x => isItemInsidePDFBox(x, coords)).filter(x => x.str.trim() !== '')[0].str;
        const match = scheduleString.match(regex);
        if (match) {
          return {
            from: `${match.groups.fromHour.padStart(2, '0')}:${match.groups.fromMinute}`,
            to: `${match.groups.toHour.padStart(2, '0')}:${match.groups.toMinute}`,
          }
        } else {
          throw('');
        }
      } catch (error) {
        return null;
      }
    },
    destination: (items) => {
      const coords = [552.10, 397.60, 754.25, 438.85];
      try {
        return items.filter(x => isItemInsidePDFBox(x, coords)).filter(x => x.str.trim() !== '').map(x => x.str.trim()).join(', ');
      } catch (error) {
        return null;
      }
    }
  };
  
  /**
    ^
    |
    |
    +------------->
   */
  
  const regexes = {
    product: /^(?<code>\d{6})\s*PLANET FARMS .*PZ\s*(?<boxes>\d*)\s*[\d,]*$/,
    totals: /^Totale Referenze\s*(?<count>\d*)\s*Totale Colli\s*(?<boxes>\d*)$/
  };

  let readProductCount = 0;
  let readBoxTotal = 0;

  const order = {
    customer: 'Dimar',
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

  // if (items.find(x => x.indexOf('Il Presente Annulla e Sostituisce il Precedente') > -1)) {
  //   order.overrides = true;
  // }

  try {

    order.delivery = pdfBoxes.delivery(text.items);

    const { from, to } = pdfBoxes.schedule(text.items);
    order.destinations[0].from = from;
    order.destinations[0].to = to;

    order.destinations[0].address = pdfBoxes.destination(text.items);

    order.date = getDateFromFilename(filename);
    order.number = `Dimar_${order.date.replace(/-/g, '')}`;

    const rows = getRows(text.items);

    for (const row of rows) {
      const matches = {};
  
      for (const regex of Object.keys(regexes)) {
        matches[regex] = row.match(regexes[regex]);
      }
  
      if (matches.product) {
        const product = products.find(x => x.customer_code === matches.product.groups.code);
        if (product) {
          const boxes = parseInt(matches.product.groups.boxes);
          const items = parseInt(boxes * product.boxItems);
          order.destinations[0].products.push({
            code: product.code,
            ean: product.ean,
            customer_code: product.customer_code,
            description: product.description,
            boxes,
            items  
          })
          order.totals.boxes += boxes;
          order.totals.items += items;
        }
      } else if (matches.totals) {
        readProductCount = parseInt(matches.totals.groups.count);
        readBoxTotal =  parseInt(matches.totals.groups.boxes);
      }
    }

    if (!order.delivery) {
      order.anomalies.push('Delivery date not found.');
    }

    if (!order.destinations[0].address) {
      order.anomalies.push('Destination address not found.')
    }

    if (!order.destinations[0].from || !order.destinations[0].to) {
      order.anomalies.push('Destination schedule not found.');
    }

    if (order.destinations[0].products.length !== readProductCount) {
      order.anomalies.push(`Calculated product count (${order.destinations[0].products.length}) and read product count (${readProductCount}) don't match!`);
    }

    if (order.totals.boxes !== readBoxTotal) {
      order.anomalies.push(`Calculated box total (${order.totals.boxes}) and read box total (${readBoxTotal}) don't match!`);
    }

  
    return order;
      
  } catch (error) {
    throw(error);    
  }

};

const analyzeConfirmation = (text, products, filename) => {

  const pdfBoxes = {
    totalCost: (items) => {
      const coords = [431.15, 203.30, 550.85, 234.65];
      const regex = /(?<total>[\d\.,]*)/;
      try {
        const stringTotal = items.filter(x => isItemInsidePDFBox(x, coords)).map(x => x.str.trim()).filter(x => x !== '').join(' ');
        const match = stringTotal.match(regex);
        if (match) {
          return parseFloat(match.groups.total.replace('.', '').replace(',', '.'));
        } else {
          throw('');
        }  
      } catch (error) {
        return null;          
      }
    },
    totalBoxes: (items) => {
      const coords = [274.10, 295.00, 402.35, 312.85];
      const regex = /TOTALE COLLI:\s*(?<total>[\d\.]*)/;
      try {
        const stringTotal = items.filter(x => isItemInsidePDFBox(x, coords)).map(x => x.str.trim()).filter(x => x !== '').join(' ');
        const match = stringTotal.match(regex);
        if (match) {
          return parseFloat(match.groups.total.replace('.', ''));
        } else {
          throw('');
        }  
      } catch (error) {
        return null;          
      }
    },
    shipping: (items) => {
      const coords = [34.70, 379.85, 744.50, 403.80];
      const regex = /MERCE MOVIMENTATA CON DOCUMENTO NUMERO:\s*(?<code>.*?)\s*DEL:\s*(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{4})/;
      try {
        const stringShipping = items.filter(x => isItemInsidePDFBox(x, coords)).map(x => x.str.trim()).filter(x => x !== '').join(' ');
        const match = stringShipping.match(regex);
        if (match) {
          return {
            code: match.groups.code,
            date: getDateFromParts(match.groups.day, match.groups.month, match.groups.year)
          };
        } else {
          throw('');
        }  
      } catch (error) {
        return null;          
      }
    }
  };

  const regexes = {
    product: /[\w\s\d\.]*\s{2}(?<cost>[\d,]*)\s*(?<code>\d{6})04\s*(?<unitCost>[\d,]*)\s*(?<items>\d*),00\s*(?<boxes>\d*)/
  };


  const confirmation = {
    customer: 'Dimar',
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

  confirmation.date = getDateFromFilename(filename);

  const totalCost = pdfBoxes.totalCost(text.items);
  const totalBoxes = pdfBoxes.totalBoxes(text.items);
  confirmation.shipping = pdfBoxes.shipping(text.items);

  const rows = getRows(text.items);

  for (const row of rows) {
    const matches = {};

    for (const regex of Object.keys(regexes)) {
      matches[regex] = row.match(regexes[regex]);
    }

    if (matches.product) {
      const product = products.find(x => x.customer_code === matches.product.groups.code);
      if (product) {
        const boxes = parseInt(matches.product.groups.boxes);
        const items = parseInt(matches.product.groups.items);

        if (items !== boxes * product.boxItems) {
          confirmation.anomalies.push(`Product "${product.description}": Calculated items (${boxes * product.boxItems}) and read items (${items}) don't match!`);
        }
  
        confirmation.products.push({
          code: product.code,
          ean: product.ean,
          customer_code: product.customer_code,
          description: product.description,
          boxes,
          items,
          unit_cost: parseFloat(matches.product.groups.unitCost.replace(',', '.')),
          total_cost: parseFloat(matches.product.groups.cost.replace(',', '.'))
        })
        confirmation.totals.boxes += boxes;
        confirmation.totals.items += items;
        confirmation.totals.cost += parseFloat(matches.product.groups.cost.replace('.', '').replace(',', '.'))
      }
    }
  }

  if (Math.abs(confirmation.totals.cost - totalCost) > 0.01) {
    confirmation.anomalies.push(`Calculated total cost (${confirmation.totals.cost.toFixed(2)}) and read total cost (${totalCost.toFixed(2)}) don't match!`);
  }

  if (confirmation.totals.boxes !== totalBoxes) {
    confirmation.anomalies.push(`Calculated total boxes (${confirmation.totals.boxes}) and read total boxes (${totalBoxes}) don't match!`);
  }


  return confirmation;
};

const documentTypes = [
  {
    name: 'order',
    filename: 'Ordine Ortofrutta Dimar',
    analyzer: analyzeOrder
  },
  {
    name: 'confirmation',
    filename: 'Prefattura Ortofrutta Dimar',
    analyzer: analyzeConfirmation
  }
];

const analyzeText = (text, products, filename) => {

  try {

    let result = {
      documentType: 'unknown',
      content: undefined
    };

    for (const documentType of documentTypes) {
      if (filename.startsWith(documentType.filename)) {
        result = {
          documentType: documentType.name,
          content: documentType.analyzer(text, products, filename)
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
