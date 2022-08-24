"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const axios = require("axios");

const getGameInfo = async (slug) => {
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;

  const formatedSlug = slug.replace(/-/g, "_");

  const body = await axios.get(`https://www.gog.com/en/game/${formatedSlug}`);

  const dom = new JSDOM(body.data);
  const description = dom.window.document.querySelector(".description");

  return {
    rating: "BR0",
    short_description: description?.textContent.slice(0, 166),
    description: description.innerHTML,
  };
};

module.exports = {
  populate: async (params) => {
    const gogApiUrl =
      "https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Abestselling&productType=in%3Agame%2Cpack%2Cdlc%2Cextras&page=1&countryCode=BR&locale=en-US&currencyCode=BRL";

    const {
      data: { products },
    } = await axios.get(gogApiUrl);

    // console.log("products", products[0]);
    console.log("getGameInfo", await getGameInfo(products[1].slug));
  },
};
