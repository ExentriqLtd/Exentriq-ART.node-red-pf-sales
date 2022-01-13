const axios = require('axios');
const xpath = require('xpath');
const dom = require('xmldom').DOMParser;

const matchingProductByEAN = (ean, products) => {
  const product = products.find(x => x.ean === ean);
  return product ? product : null;
};

const getURL = async (body) => {
  try {
    const rows = body.split('\n');
    const linkRow = rows.find(x => x.startsWith('[https://vendor.marketman.com/'));
    return linkRow ? linkRow.slice(1, -1) : null;      
  } catch (error) {
    throw(error);
  }
};

const downloadPage = async (url) => {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    throw(err);
  }
};

const getDate = (dateString) => {
  return (new Date(parseInt(dateString.slice(6, 10)), parseInt(dateString.slice(3, 5)) - 1, parseInt(dateString.slice(0, 2)), 10, 0, 0)).toISOString().slice(0, 10);
};

const getOrder = async (html, products) => {

  const order = {
    anomalies: [],
    number: null,
    overrides: false,
    date: null,
    delivery: null,
    destinations: [{
      address: null,
      from: null,
      to: null,
      products: []
    }],
    totals: {
      boxes: 0,
      items: 0
    }
  };
  const doc = new dom().parseFromString(html);

  order.number = xpath.select(`//*[local-name(.)='span'][@id='ContentPlaceHolder1_lblOrderNumber']`, doc)[0].firstChild.nodeValue;

  const dateString = xpath.select(`//*[local-name(.)='span'][@id='ContentPlaceHolder1_lblSentDate']`, doc)[0].firstChild.nodeValue;
  order.date = getDate(dateString);

  const deliveryString = xpath.select(`//*[local-name(.)='span'][@id='ContentPlaceHolder1_lblDeliveryDate']`, doc)[0].firstChild.nodeValue;
  order.delivery = getDate(deliveryString);

  order.destinations[0].address = xpath.select(`//*[local-name(.)='span'][@id='ContentPlaceHolder1_lblAddress']`, doc)[0].firstChild.nodeValue;

  const codes = xpath.select("//*[local-name(.)='span'][starts-with(@id, 'ContentPlaceHolder1_rptData_lblItemCode_')]", doc).map(x => x.firstChild.nodeValue);

  for (let index = 0; index < codes.length; index++) {
    const quantity = xpath.select(`//*[local-name(.)='span'][@id='ContentPlaceHolder1_rptData_lblQuantity_${index}']`, doc)[0].firstChild.nodeValue;

    const { code, ean, customer_code, description, boxItems } = matchingProductByEAN(codes[index], products);

    if (code) {
      const product = {
        code,
        ean,
        customer_code,
        description,
        boxes: parseInt(quantity),
        items: parseInt(quantity) * boxItems
      };
      order.totals.boxes += product.boxes;
      order.totals.items += product.items;
      order.destinations[0].products.push(product);  
    } else {
      order.anomalies.push(`Product code ${codes[index]} not found`)
    }
    
  }

  return order;

};

const retrieveOrder = async (body, products) => {

  try {
    const url = await getURL(body);
    const page = await downloadPage(url);
    return getOrder(page, products);
  } catch (error) {
    throw(error);
  }

}

module.exports = {
  retrieveOrder
};
