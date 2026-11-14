const StockMovement = require("../models/StockMovement");

const calculateStock = async (productId, session = null) => {
  const pipeline = [
    {
      $match: {
        product: productId,
      },
    },
    {
      $group: {
        _id: null,
        stock: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ["$type", ["opening", "purchase", "return"]],
                  },
                  then: "$quantity",
                },
                {
                  case: {
                    $eq: ["$type", "sale"],
                  },
                  then: { $multiply: ["$quantity", -1] },
                },
                {
                  case: {
                    $and: [
                      { $eq: ["$type", "adjustment"] },
                      { $eq: ["$direction", "in"] },
                    ],
                  },
                  then: "$quantity",
                },
                {
                  case: {
                    $and: [
                      { $eq: ["$type", "adjustment"] },
                      { $eq: ["$direction", "out"] },
                    ],
                  },
                  then: { $multiply: ["$quantity", -1] },
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
  ];

  const query = StockMovement.aggregate(pipeline);

  if (session) {
    query.session(session);
  }

  const result = await query;

  return result.length > 0 ? result[0].stock : 0;
};

module.exports = { calculateStock };