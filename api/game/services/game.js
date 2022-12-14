"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const axios = require("axios");
const slugify = require("slugify");

function Exception(e) {
  return { e, data: e.data && e.data.errors && e.data.errors };
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getGameInfo = async (slug) => {
  try {
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;

    const formatedSlug = slug.replace(/-/g, "_");

    const body = await axios.get(`https://www.gog.com/en/game/${formatedSlug}`);

    const dom = new JSDOM(body.data);
    const description = dom.window.document.querySelector(".description");

    return {
      rating: "BR0",
      short_description: description?.textContent.slice(0, 160),
      description: description.innerHTML,
    };
  } catch (e) {
    console.log("!! getGameInfo", Exception(e));
  }
};

const getByName = async (name, entityName) => {
  const item = await strapi.services[entityName].find({ name });
  return item.length ? item[0] : null;
};

const create = async (name, entityName) => {
  const item = await getByName(name, entityName);

  if (!item) {
    return await strapi.services[entityName].create({
      name,
      slug: slugify(name, { lower: true }),
    });
  }
};

const createManyToManyData = async (products) => {
  const developersObj = {};
  const publishersObj = {};
  const categoriesObj = {};
  const platformsObj = {};

  products.forEach((product) => {
    const { developers, publishers, genres, operatingSystems } = product;

    developers &&
      developers.forEach((item) => {
        developersObj[item] = true;
      });
    publishers &&
      publishers.forEach((item) => {
        publishersObj[item] = true;
      });
    genres &&
      genres.forEach((item) => {
        categoriesObj[item.name] = true;
      });
    operatingSystems &&
      operatingSystems.forEach((item) => {
        platformsObj[item] = true;
      });
  });

  Promise.all([
    ...Object.keys(developersObj).map((name) => create(name, "developer")),
    ...Object.keys(publishersObj).map((name) => create(name, "publisher")),
    ...Object.keys(categoriesObj).map((name) => create(name, "category")),
    ...Object.keys(platformsObj).map((name) => create(name, "platform")),
  ]);
};

const setImage = async ({ image, game, field = "cover" }) => {
  try {
    let url = image;

    if (field !== "cover") {
      url = image.replace("_{formatter}", "_bg_crop_1680x655");
    }

    const { data } = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(data, "base64");

    const FormData = require("form-data");
    const formData = new FormData();

    formData.append("refId", game.id);
    formData.append("ref", "game");
    formData.append("field", field);
    formData.append("files", buffer, { filename: `${game.slug}.jpg` });

    console.info(`Uploading ${field} image: ${game.slug}.jpg`);

    await axios({
      method: "POST",
      url: `http://${strapi.config.host}:${strapi.config.port}/upload`,
      data: formData,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
      },
    });
  } catch (e) {
    console.log("!! setImage", Exception(e));
  }
};

const createGames = async (products) => {
  await Promise.all(
    products.map(async (product) => {
      const item = await getByName(product.title, "game");

      if (!item) {
        console.info(`Creating: * ${product.title} *`);

        const price = product.price.final;
        const game = await strapi.services.game.create({
          name: product.title,
          slug: product.slug.replace(/_/g, "-"),
          price: price.slice(2, price.length),
          release_date: new Date(product.releaseDate),
          categories: await Promise.all(
            product.genres.map((category) =>
              getByName(category.name, "category")
            )
          ),
          developers: await Promise.all(
            product.developers.map((developer) =>
              getByName(developer, "developer")
            )
          ),
          platforms: await Promise.all(
            product.operatingSystems.map((system) =>
              getByName(system, "platform")
            )
          ),
          publishers: await Promise.all(
            product.publishers.map((publisher) =>
              getByName(publisher, "publisher")
            )
          ),
          ...(await getGameInfo(product.slug)),
        });

        await setImage({ image: product.coverHorizontal, game });
        await Promise.all(
          product.screenshots
            .slice(0, 5)
            .map((url) => setImage({ image: url, game, field: "gallery" }))
        );

        await timeout(3000);

        return game;
      }
    })
  );
};

module.exports = {
  populate: async (params) => {
    try {
      const gogApiUrl =
        "https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Abestselling&productType=in%3Agame%2Cpack%2Cdlc%2Cextras&page=1&countryCode=BR&locale=en-US&currencyCode=BRL";

      const {
        data: { products },
      } = await axios.get(gogApiUrl);

      await createManyToManyData(products);
      await createGames(products);
    } catch (e) {
      console.log("!! populate", Exception(e));
    }
  },
};
