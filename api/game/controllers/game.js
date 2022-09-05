"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  populate: async (ctx) => {
    console.log("Initializing...");

    /*     const options = {
      sort: "popularity",
      page: "1",
      ...ctx.query,
    }; */

    await strapi.services.game.populate();

    console.log("*** Process finished ****");

    ctx.send("Finished populating!");
  },
};
