# Planet Farms: Structured data extraction from PDF files

## Orders

The following schema complies with [JSON Schema](https://json-schema.org/) (version `draft-06`).

All fields are mandatory, so they must be present in the JSON that needs to be validated (some fields are *nullable*).

### JSON Schema

~~~json
{
  "$schema": "http://json-schema.org/draft-06/schema#",
  "$ref": "#/definitions/Order",
  "definitions": {
    "Order": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "customer": {
          "type": "string"
        },
        "anomalies": {
          "type": ["array", "null"],
          "items": {
            "type": "string"
          }
        },
        "number": {
          "type": "string"
        },
        "overrides": {
          "type": "boolean"
        },
        "date": {
          "type": "string"
        },
        "delivery": {
          "type": "string"
        },
        "destinations": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/Destination"
          }
        },
        "totals": {
          "$ref": "#/definitions/Totals"
        }
      },
      "required": [
        "anomalies",
        "customer",
        "date",
        "delivery",
        "destinations",
        "number",
        "overrides",
        "totals"
      ],
      "title": "Welcome"
    },
    "Destination": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": ["string", "null"]
        },
        "address": {
          "type": "string"
        },
        "from": {
          "type": ["string", "null"]
        },
        "to": {
          "type": ["string", "null"]
        },
        "products": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/Product"
          }
        }
      },
      "required": [
        "address",
        "from",
        "to",
        "products"
      ],
      "title": "Destination"
    },
    "Product": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "code": {
          "type": "string"
        },
        "customer_code": {
            "type": "string"
        },
        "ean": {
            "type": "string"
        },
        "description": {
          "type": "string"
        },
        "boxes": {
          "type": "integer",
          "minimum": 0
        },
        "items": {
          "type": "integer",
          "minimum": 0
        }
      },
      "required": [
        "boxes",
        "code",
        "customer_code",
        "ean",
        "description",
        "items"
      ],
      "title": "Product"
    },
    "Totals": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "boxes": {
          "type": "integer",
          "minimum": 0
        },
        "items": {
          "type": "integer",
          "minimum": 0
        }
      },
      "required": [
        "boxes",
        "items"
      ],
      "title": "Totals"
    }
  }
}
~~~

### Order Examples

#### Esselunga

~~~json
{
  "customer": "Esselunga",
  "anomalies": [],
  "number": "M/2101041237",
  "overrides": false,
  "date": "2021-10-19",
  "delivery": "2021-10-20",
  "destination": {
    "address": "LIMITO DI PIOLTELLO (MI) VIA GIAMBOLOGNA, 1",
    "from": "20:00",
    "to": "5:00"
  },
  "products": [
    {
      "code": "200004",
      "ean": "8059300850091",
      "customer_code": "755001",
      "description": "Yummix Delicato 80g",
      "boxes": 38,
      "items": 304
    },
    {
      "code": "200002",
      "ean": "8059300850077",
      "customer_code": "755002",
      "description": "Yummix Orientale 80g",
      "boxes": 41,
      "items": 328
    },
    {
      "code": "200003",
      "ean": "8059300850084",
      "customer_code": "755003",
      "description": "Yummix Piccante 80g",
      "boxes": 40,
      "items": 320
    },
    {
      "code": "200000",
      "ean": "8059300850039",
      "customer_code": "755005",
      "description": "Lattugood 80g",
      "boxes": 35,
      "items": 280
    }
  ],
  "totals": {
    "boxes": 154,
    "items": 1232
  }
}
~~~

#### Ortofin

~~~json
{
  "customer": "Ortofin",
  "anomalies": [],
  "number": "9535180212850",
  "overrides": false,
  "date": "2021-10-11",
  "delivery": "2021-10-12",
  "destination": {
    "address": "Via del Lago 14/20, 20050 Liscate (MI)",
    "from": null,
    "to": null
  },
  "products": [
    {
      "code": "200004",
      "customer_code": "0350303021",
      "ean": "8059300850091",
      "description": "Yummix Delicato 80g",
      "boxes": 5,
      "items": 40
    },
    {
      "code": "200002",
      "customer_code": "0350303019",
      "ean": "8059300850077",
      "description": "Yummix Orientale 80g",
      "boxes": 6,
      "items": 48
    },
    {
      "code": "200003",
      "customer_code": "0350303020",
      "ean": "8059300850084",
      "description": "Yummix Piccante 80g",
      "boxes": 8,
      "items": 64
    },
    {
      "code": "200000",
      "customer_code": "0350303022",
      "ean": "8059300850039",
      "description": "Lattugood 80g",
      "boxes": 7,
      "items": 56
    }
  ],
  "totals": {
    "boxes": 26,
    "items": 208
  }
}
~~~

## Confirmations

The following schema complies with [JSON Schema](https://json-schema.org/) (version `draft-06`).

All fields are mandatory, so they must be present in the JSON that needs to be validated (some fields are *nullable*).

~~~json
{
  "$schema": "http://json-schema.org/draft-06/schema#",
  "$ref": "#/definitions/Confirmation",
  "definitions": {
    "Confirmation": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "customer": {
          "type": "string"
        },
        "anomalies": {
          "type": ["array", "null"],
          "items": {
            "type": "string"
          }
        },
        "date": {
          "type": "string"
        },
        "order": {
          "type": ["string", "null"]
        },
        "shipping": {
          "$ref": "#/definitions/Shipping"
        },
        "products": {
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/Product"
          }
        },
        "totals": {
          "$ref": "#/definitions/Totals"
        }
      },
      "required": [
        "anomalies",
        "customer",
        "date",
        "order",
        "products",
        "shipping",
        "totals"
      ],
      "title": "Welcome"
    },
    "Product": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "code": {
          "type": "string"
        },
        "customer_code": {
          "type": "string"
        },
        "ean": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "boxes": {
          "type": "integer",
          "minimum": 0
        },
        "items": {
          "type": "integer",
          "minimum": 0
        },
        "unit_cost": {
          "type": "number"
        },
        "total_cost": {
          "type": "number"
        }
      },
      "required": [
        "boxes",
        "code",
        "customer_code",
        "ean",
        "description",
        "items",
        "total_cost",
        "unit_cost"
      ],
      "title": "Product"
    },
    "Shipping": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "code": {
          "type": ["string", "null"]
        },
        "date": {
          "type": ["string", "null"]
        }
      },
      "required": [
        "code",
        "date"
      ],
      "title": "Shipping"
    },
    "Totals": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "boxes": {
          "type": "integer",
          "minimum": 0
        },
        "items": {
          "type": "integer",
          "minimum": 0
        },
        "cost": {
          "type": "number"
        }
      },
      "required": [
        "boxes",
        "cost",
        "items"
      ],
      "title": "Totals"
    }
  }
}
~~~


### Confirmation Examples

#### Esselunga

~~~json
{
  "customer": "Esselunga",
  "anomalies": [],
  "date": "2021-10-20",
  "order": "M/2101041237",
  "shipping": {
    "code": null,
    "date": null
  },
  "products": [
    {
      "customer_code": "755001",
      "description": "Yummix Delicato 80g",
      "boxes": 38,
      "items": 304,
      "unit_cost": 1.55,
      "total_cost": 471.2,
      "code": "200004",
      "ean": "8059300850091"
    },
    {
      "customer_code": "755002",
      "description": "Yummix Orientale 80g",
      "boxes": 41,
      "items": 328,
      "unit_cost": 1.55,
      "total_cost": 508.4,
      "code": "200002",
      "ean": "8059300850077"
    },
    {
      "customer_code": "755003",
      "description": "Yummix Piccante 80g",
      "boxes": 40,
      "items": 320,
      "unit_cost": 1.55,
      "total_cost": 496,
      "code": "200003",
      "ean": "8059300850084"
    },
    {
      "customer_code": "755005",
      "description": "Lattugood 80g",
      "boxes": 35,
      "items": 280,
      "unit_cost": 1.42,
      "total_cost": 397.6,
      "code": "200000",
      "ean": "8059300850039"
    }
  ],
  "totals": {
    "boxes": 154,
    "items": 1232,
    "cost": 1873.2
  }
}
~~~

#### Ortofin

~~~json
{
  "customer": "Ortofin",
  "anomalies": [],
  "date": "2021-10-11",
  "order": null,
  "shipping": {
    "code": "00267",
    "date": "2021-10-09"
  },
  "products": [
    {
      "code": "200004",
      "customer_code": "0350303021",
      "ean": "8059300850091",
      "description": "Yummix Delicato 80g",
      "boxes": 17,
      "items": 136,
      "unit_cost": 1.58,
      "total_cost": 214.88
    },
    {
      "code": "200002",
      "customer_code": "0350303019",
      "ean": "8059300850077",
      "description": "Yummix Orientale 80g",
      "boxes": 6,
      "items": 48,
      "unit_cost": 1.58,
      "total_cost": 75.84
    },
    {
      "code": "200000",
      "customer_code": "0350303022",
      "ean": "8059300850039",
      "description": "Lattugood 80g",
      "boxes": 20,
      "items": 160,
      "unit_cost": 1.45,
      "total_cost": 232
    }
  ],
  "totals": {
    "boxes": 43,
    "items": 344,
    "cost": 522.72
  }
}
~~~