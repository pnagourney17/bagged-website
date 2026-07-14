chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getProduct") {
        const product = {
            name: document.title.split('|')[0].split('-')[0].trim(),
            brand: window.location.hostname.replace('www.', ''),
            price: "price not found",
            image: "",
            url: window.location.href
        };

        // Price detection
        const priceSelectors = [
            '[class*="price"]', '[id*="price"]', '.amount', '.money',
            'meta[property="og:price:amount"]', 'meta[name="twitter:data1"]'
        ];

        for (let selector of priceSelectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText && el.innerText.match(/\d/)) {
                product.price = el.innerText.trim();
                break;
            }
        }

        // Image detection - try multiple sources
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) {
            product.image = ogImage.content;
        } else {
            const productImg = document.querySelector('img[class*="product"]') ||
                document.querySelector('img[class*="gallery"]') ||
                document.querySelector('img[class*="main"]');
            if (productImg) {
                product.image = productImg.src;
            }
        }

        sendResponse(product);
    }
    return true;
});
