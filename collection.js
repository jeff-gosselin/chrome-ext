const ul = document.getElementById("ringsList");
const radios = document.querySelectorAll('input[type="radio"]');
const search = document.getElementById("search");

/**
 * Pretty much a sort function for when the sort buttons are clicked
 */
const dynamicSort = sortProperty => {
  if (sortProperty === "price") {
    return function(a, b) {
      const result =
        parseFloat(a[sortProperty]) < parseFloat(b[sortProperty])
          ? -1
          : parseFloat(a[sortProperty]) > parseFloat(b[sortProperty])
          ? 1
          : 0;
      return result;
    };
  }

  return function(a, b) {
    const result =
      a[sortProperty] < b[sortProperty]
        ? -1
        : a[sortProperty] > b[sortProperty]
        ? 1
        : 0;
    return result;
  };
};

/**
 * Add event listener to radio inputs, reloading data when clicked
 */
radios.forEach(radio => {
  radio.onclick = e => {
    ul.innerHTML = "";
    setup(allData, e.target.value);
  };
});

/**
 * Add event listener to search input, filtering and reloading data when changed
 */
search.oninput = e => {
  ul.innerHTML = "";
  setup(allData, null, (searchValue = e.target.value));
};

let allData;

// initial setup, fetching, and saving data to variables
chrome.storage.sync.get("ringUrls", function(result) {
  console.log("THE URLS: ", result.ringUrls);
  const urlData = result.ringUrls
    .filter(n => n)
    .map(async url => {
      return await unpackUrl(url);
    });
  Promise.all(urlData).then(urlData => {
    allData = urlData;
    setup(allData);
  });
});

/**
 * Main setup function. Called after every filter / sorting. Not called initially.
 * Appends HTML item cards to ul element.
 */
const setup = (allData, sortProperty = null, searchValue = "") => {
  console.log(allData);
  allData
    .sort(dynamicSort(sortProperty))
    .filter(data => data.title.toLowerCase().includes(searchValue))
    .forEach(data => {
      ul.appendChild(turnDataIntoHtml(data));
    });
};

/**
 * Pure function that returns JS Object with scraped metadata values.
 */
const unpackUrl = async url => {
  return await fetchAndParseUrl(url).then(htmlDocument => {
    return scrapeInfo(htmlDocument, url);
  });
};

const proxyurl = "https://cors-anywhere.herokuapp.com/";

/**
 * fetch and parse a given url and return HTML Document
 */
const fetchAndParseUrl = thisUrl => {
  return fetch(thisUrl).then(res => {
    if (res.ok) {
      return res.text().then(site => {
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(site, "text/html");
        return htmlDocument;
      });
    } else {
      return thisUrl === proxyurl + url
        ? null
        : fetchAndParseUrl(proxyurl + url);
    }
  });
};

/**
 * Scrape metadata from given HTML Document and return JS Object of data
 */
const scrapeInfo = (site, url) => {
  const data = {
    url: url,
    title: scrapeField("name", site).length
      ? scrapeField("name", site)[0]
      : site.title,
    image: scrapeField("image", site)[0],
    description: scrapeField("description", site)[0],
    price: scrapeField("price", site)[0] || scrapeField("price:amount", site)[0]
  };

  return data;
};

/**
 * Takes JS Object of data and creates item card and remove button
 */
const turnDataIntoHtml = data => {
  const div = `<div>
    <a href="${data.url}" rel="nofollow" target="_blank">
    <h4>${data.title}</h4>
    </a>
    <img src="${imagePrependHttp(
      data.image
    )}" style="display: block; margin-left: auto; margin-right: auto; width: 50%;">
    <p>${decodeHtmlEntities(data.description)}</p>
    <h4>Price: $${data.price}</h4>
    </div>`;

  const li = document.createElement("li");
  li.style.width = "22%";
  li.style.display = "inline-block";
  li.style.verticalAlign = "top";
  li.style.padding = "10px";

  li.innerHTML = div;
  const remove = document.createElement("button");
  remove.innerText = "remove";
  remove.style.float = "right";
  li.appendChild(remove);

  remove.onclick = e => {
    removeItemFromList(data.url);
    location.reload();
  };

  return li;
};

const clearButton = document.getElementById("clear");

clearButton.addEventListener("click", event => {
  console.log("clear button clicked");
  chrome.storage.sync.clear(); // Geeez why didn't I think of this...
  location.reload();
});

const removeItemFromList = removeUrl => {
  console.log("REMOVE HERE: ", removeUrl);
  chrome.storage.sync.get("ringUrls", function(result) {
    const newArray = result.ringUrls.filter(url => url !== removeUrl);
    console.log(newArray);
    chrome.storage.sync.set({ ringUrls: newArray });
  });
};

/**
 * Rules for scraping HTML Document to find metadata. Returns array of found data.
 */
const scrapeField = (field, doc) => {
  let rules = [
    function() {
      if (doc.querySelectorAll('[itemprop="' + field + '"]').length) {
        return doc.querySelectorAll('[itemprop="' + field + '"]')[0].content;
      }
    },
    function() {
      if (doc.querySelectorAll('meta[property="og:' + field + '"]').length) {
        return doc.querySelectorAll('meta[property="og:' + field + '"]')[0]
          .content;
      }
    },
    function() {
      if (
        doc.querySelectorAll('meta[property="twitter:' + field + '"]').length
      ) {
        return doc.querySelectorAll('meta[property="twitter:' + field + '"]')[0]
          .content;
      }
    },
    function() {
      if (doc.querySelectorAll('meta[name="og:' + field + '"]').length) {
        return doc.querySelectorAll('meta[name="og:' + field + '"]')[0].content;
      }
    },
    function() {
      if (doc.querySelectorAll('meta[name="twitter:' + field + '"]').length) {
        return doc.querySelectorAll('meta[name="twitter:' + field + '"]')[0]
          .content;
      }
    },
    function() {
      if (doc.querySelectorAll('meta[itemprop="' + field + '"]').length) {
        return doc.querySelectorAll('meta[itemprop="' + field + '"]')[0]
          .content;
      }
    },
    function() {
      if (doc.querySelectorAll('meta[name="' + field + '"]').length) {
        return doc.querySelectorAll('meta[name="' + field + '"]')[0].content;
      }
    },
    function() {
      if (doc.querySelectorAll('span[itemprop="' + field + '"]').length) {
        return doc
          .querySelectorAll('span[itemprop="' + field + '"]')[0]
          .getAttribute("content");
      }
    },
    function() {
      if (doc.querySelectorAll('script[type="application/ld+json"]').length) {
        const arr = [];
        doc
          .querySelectorAll('script[type="application/ld+json"]')
          .forEach(json => {
            const a = [];

            jsonFieldFinder(JSON.parse(json.innerText), field, a);
            arr.push(a);
          });
        return arr.filter(item => item.length);
      }
    }
  ];

  if (field === "image") {
    rules.push(function() {
      if (doc.querySelectorAll('img[itemprop="image"]').length) {
        return doc.querySelectorAll('img[itemprop="image"]')[0].src;
      }
    });
  }
  if (field === "name") {
    rules.push(function() {
      if (doc.querySelectorAll("h1").length) {
        return doc.querySelectorAll("h1")[0].innerText.trim();
      }
    });
  }

  return rules
    .map(rule => rule())
    .filter(rule => rule)
    .flat()
    .flat();
};

/**
 * Function for scraping HTML Document to find LD-JSON metadata.
 * Returns array of found data.
 */
const jsonFieldFinder = (json, field, array) => {
  // if (array.length < 1) {
  // comment this line to get multiple results
  if (
    field in json &&
    // json["@type"] === "Product" &&
    typeof json[field] == "string"
  ) {
    // success
    array.push(json[field]);
  } else {
    for (let i = 0; i < Object.keys(json).length; i++) {
      if (typeof json[Object.keys(json)[i]] == "object") {
        jsonFieldFinder(json[Object.keys(json)[i]], field, array);
      }
    }
  }
  // }
};

const decodeHtmlEntities = str => {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
};

const imagePrependHttp = src => {
  if (src.startsWith("//")) {
    return "http:" + src;
  }
  return src;
};
