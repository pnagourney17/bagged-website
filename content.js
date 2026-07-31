if (!window.baggedScraperLoaded) {
    window.baggedScraperLoaded = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getProduct") {
            const product = {
                name: document.title.split('|')[0].split('-')[0].trim(),
                brand: window.location.hostname.replace('www.', ''),
                price: "price not found",
                image: "",
                url: window.location.href,
                sizes: getSizes(),
                colors: getColours(),
                activeSize: getActiveSize(),
                activeColor: getActiveColour()
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

    function isJunkSize(txt) {
        if (!txt || txt.length === 0 || txt.length > 45) return true;
        const lower = txt.toLowerCase().trim();
        if (/^(?:select|size|choose|select a size|add|add to bag|add to basket|add to cart|put it in your basket|put it in your bag)$/i.test(lower)) return true;
        const junkKeywords = [
            'product measurements', 'measurements', 'size guide', 'find your size',
            'what is my size', 'check in-store', 'view size chart', 'size info',
            'how to measure', 'fit guide', 'size assistance', 'add to bag', 'add to cart',
            'add to basket', 'add', 'process order', 'buy now', 'checkout',
            'put it in your basket', 'put it in your bag', 'size recommender',
            'smaller fit', 'larger fit', 'view similar', 'coming soon'
        ];
        return junkKeywords.some(keyword => lower === keyword || lower.startsWith(keyword) || lower.includes(keyword));
    }

    function extractClothingSizeCode(rawText) {
        if (!rawText) return null;
        const clean = rawText.trim();
        const match = clean.match(/^(XXS|XS|S|M|L|XL|XXL|XXXL|[0-9]{1,2}(?:\.[0-9])?|UK\s*[0-9]{1,2}|EU\s*[0-9]{1,2}|US\s*[0-9]{1,2}|IT\s*[0-9]{1,2})(?:\s+|$)/i);
        if (match) {
            let code = match[1].toUpperCase();
            if (/few items left/i.test(clean)) return `${code} (Few left)`;
            if (/coming soon/i.test(clean)) return `${code} (Coming soon)`;
            if (/view similar|out of stock|sold out/i.test(clean)) return `${code} (Sold out)`;
            return code;
        }
        return null;
    }

    function getSizes() {
        let sizes = [];

        // 0. Zara & Fast Fashion Targeted Selectors
        const zaraSizeEls = document.querySelectorAll(`
            .product-detail-size-selector__size-list-item,
            .product-detail-size-selector__size-list-item-name,
            [data-qa-action="size-selector-sizes-size"],
            [data-qa-action="size-selector-sizes-size-link"],
            .size-selector-sizes__size,
            [class*="size-selector"] li,
            [class*="product-size-selector"] li,
            [class*="size-selector-sizes"] button,
            [class*="product-detail-size"] li
        `);

        if (zaraSizeEls.length > 0) {
            zaraSizeEls.forEach(el => {
                let txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                const parsedCode = extractClothingSizeCode(txt);
                if (parsedCode) {
                    sizes.push(parsedCode);
                } else if (!isJunkSize(txt)) {
                    sizes.push(txt);
                }
            });
            if (sizes.length > 0) return [...new Set(sizes)].filter(s => !isJunkSize(s)).slice(0, 20);
        }

        // 1. Check all select elements and custom dropdowns
        const selects = Array.from(document.querySelectorAll('select, [data-qa*="size" i], [class*="size-selector" i], [class*="SizeSelector" i], [class*="select-size" i], [class*="SizeDropdown" i]'));
        for (let select of selects) {
            const attrStr = (select.id + ' ' + select.className + ' ' + select.name + ' ' + (select.getAttribute('aria-label') || '') + ' ' + (select.getAttribute('data-qa') || '')).toLowerCase();
            if (attrStr.includes('size') || attrStr.includes('dimension') || select.tagName === 'SELECT') {
                let options = [];
                if (select.tagName === 'SELECT') {
                    options = Array.from(select.options)
                        .map(opt => (opt.innerText || opt.textContent || '').replace(/\s+/g, ' ').trim())
                        .filter(txt => !isJunkSize(txt));
                } else {
                    const optEls = select.querySelectorAll('option, [role="option"], li, button, span[class*="size"]');
                    options = Array.from(optEls)
                        .map(opt => (opt.innerText || opt.textContent || '').replace(/\s+/g, ' ').trim())
                        .map(txt => extractClothingSizeCode(txt) || txt)
                        .filter(txt => !isJunkSize(txt));
                }
                if (options.length > 0) {
                    sizes = options;
                    break;
                }
            }
        }
        
        // 2. Check radio inputs
        if (sizes.length === 0) {
            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
            const sizeRadios = radios.filter(r => {
                const attr = (r.id + ' ' + r.className + ' ' + r.name).toLowerCase();
                return attr.includes('size');
            });
            if (sizeRadios.length > 0) {
                sizeRadios.forEach(r => {
                    let labelText = '';
                    if (r.id) {
                        const label = document.querySelector(`label[for="${r.id}"]`);
                        if (label) labelText = label.innerText.trim();
                    }
                    if (!labelText) {
                        const parent = r.closest('label');
                        if (parent) labelText = parent.innerText.trim();
                    }
                    if (labelText && !isJunkSize(labelText)) sizes.push(extractClothingSizeCode(labelText) || labelText);
                });
            }
        }
        
        // 3. Check for elements inside size containers (buttons, swatches, pills)
        if (sizes.length === 0) {
            const sizeContainers = document.querySelectorAll('[class*="size" i], [id*="size" i], [class*="dimension" i], [data-qa*="size" i]');
            for (let container of sizeContainers) {
                const items = Array.from(container.querySelectorAll('button, li, [role="radio"], .swatch, [class*="item"], [class*="value"], [class*="option"], span'));
                const textOptions = items
                    .map(item => (item.innerText || item.textContent || '').replace(/\s+/g, ' ').trim())
                    .map(txt => extractClothingSizeCode(txt) || txt)
                    .filter(txt => !isJunkSize(txt));
                if (textOptions.length > 0 && textOptions.length < 40) {
                    sizes = [...new Set(textOptions)];
                    break;
                }
            }
        }

        // 4. Scan page text & scripts for Zara product variants
        if (sizes.length === 0) {
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                const content = script.innerText || '';
                if (content.includes('sizes') || content.includes('size')) {
                    const matches = content.match(/"name"\s*:\s*"(XXS|XS|S|M|L|XL|XXL|XXXL|[0-9]{2}(?:\.[0-9])?)"/gi);
                    if (matches) {
                        matches.forEach(m => {
                            const val = m.replace(/"name"\s*:\s*"/i, '').replace('"', '').trim();
                            if (!isJunkSize(val)) sizes.push(val);
                        });
                    }
                }
            }
        }

        // 5. Fallback to activeSize or Category Defaults if sizes array is empty
        if (sizes.length === 0) {
            const active = getActiveSize();
            if (active && !isJunkSize(active)) {
                sizes = [active];
            } else {
                const isShoes = /boot|shoe|sandal|sneaker|heel|mule|flat|loafers|pumps|footwear|slides|clogs/i.test(document.title + ' ' + window.location.href);
                sizes = isShoes 
                    ? ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8']
                    : ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            }
        }
        
        return [...new Set(sizes)].filter(s => !isJunkSize(s)).slice(0, 20);
    }

    function getColours() {
        let colours = [];
        // 1. Check select elements
        const selects = Array.from(document.querySelectorAll('select'));
        for (let select of selects) {
            const attrStr = (select.id + ' ' + select.className + ' ' + select.name + ' ' + (select.getAttribute('aria-label') || '')).toLowerCase();
            if (attrStr.includes('color') || attrStr.includes('colour') || attrStr.includes('shade')) {
                const options = Array.from(select.options)
                    .map(opt => opt.innerText.trim())
                    .filter(txt => txt && !/select|choose/i.test(txt));
                if (options.length > 0) {
                    colours = options;
                    break;
                }
            }
        }
        
        // 2. Check radio inputs
        if (colours.length === 0) {
            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
            const colourRadios = radios.filter(r => {
                const attr = (r.id + ' ' + r.className + ' ' + r.name).toLowerCase();
                return attr.includes('color') || attr.includes('colour');
            });
            if (colourRadios.length > 0) {
                colourRadios.forEach(r => {
                    let labelText = '';
                    if (r.id) {
                        const label = document.querySelector(`label[for="${r.id}"]`);
                        if (label) labelText = label.innerText.trim();
                    }
                    if (!labelText) {
                        const parent = r.closest('label');
                        if (parent) labelText = parent.innerText.trim();
                    }
                    if (labelText) colours.push(labelText);
                });
            }
        }
        
        // 3. Check for buttons/swatches inside colour containers
        if (colours.length === 0) {
            const colorContainers = document.querySelectorAll('[class*="color" i], [id*="color" i], [class*="colour" i], [id*="colour" i], [class*="swatch" i]');
            for (let container of colorContainers) {
                const items = Array.from(container.querySelectorAll('button, li, img, [role="radio"], .swatch, [class*="item"], [class*="value"]'));
                let options = [];
                items.forEach(item => {
                    if (item.tagName === 'IMG') {
                        const val = item.getAttribute('alt') || item.getAttribute('title');
                        if (val) options.push(val.trim());
                    } else {
                        const title = item.getAttribute('title') || item.getAttribute('aria-label') || item.innerText.trim();
                        if (title && title.length < 25 && !/select|color|colour/i.test(title)) {
                            options.push(title);
                        }
                    }
                });
                if (options.length > 0 && options.length < 30) {
                    colours = [...new Set(options)];
                    break;
                }
            }
        }
        
        return [...new Set(colours)].slice(0, 15);
    }

    function getActiveSize() {
        // 1. Check select dropdown
        const selects = Array.from(document.querySelectorAll('select'));
        for (let select of selects) {
            const attrStr = (select.id + ' ' + select.className + ' ' + select.name + ' ' + (select.getAttribute('aria-label') || '')).toLowerCase();
            if (attrStr.includes('size') || attrStr.includes('dimension')) {
                if (select.selectedIndex >= 0) {
                    const txt = select.options[select.selectedIndex].innerText.trim();
                    if (txt && !/select|choose/i.test(txt)) return txt;
                }
            }
        }

        // 2. Check checked radio input
        const radios = Array.from(document.querySelectorAll('input[type="radio"]:checked'));
        for (let r of radios) {
            const attr = (r.id + ' ' + r.className + ' ' + r.name).toLowerCase();
            if (attr.includes('size')) {
                let labelText = '';
                if (r.id) {
                    const label = document.querySelector(`label[for="${r.id}"]`);
                    if (label) labelText = label.innerText.trim();
                }
                if (!labelText) {
                    const parent = r.closest('label');
                    if (parent) labelText = parent.innerText.trim();
                }
                if (labelText) return labelText;
            }
        }

        // 3. Check active button/li/span in size containers
        const sizeContainers = document.querySelectorAll('[class*="size" i], [id*="size" i], [class*="dimension" i]');
        for (let container of sizeContainers) {
            const activeItem = container.querySelector('[class*="active" i], [class*="selected" i], [class*="checked" i], [aria-checked="true"]');
            if (activeItem) {
                const txt = activeItem.innerText.trim();
                if (txt && txt.length > 0 && txt.length < 15 && !/size/i.test(txt)) return txt;
            }
        }

        // 4. Look for text labels indicating size, e.g. "Size: M"
        const labels = Array.from(document.querySelectorAll('p, span, div, label'));
        for (let l of labels) {
            if (l.childElementCount === 0 && /^(?:size|selected size)\s*:\s*(.+)$/i.test(l.innerText)) {
                const match = l.innerText.match(/^(?:size|selected size)\s*:\s*(.+)$/i);
                if (match && match[1].trim().length < 15) return match[1].trim();
            }
        }

        return "";
    }

    function getActiveColour() {
        // 1. Check select dropdown
        const selects = Array.from(document.querySelectorAll('select'));
        for (let select of selects) {
            const attrStr = (select.id + ' ' + select.className + ' ' + select.name + ' ' + (select.getAttribute('aria-label') || '')).toLowerCase();
            if (attrStr.includes('color') || attrStr.includes('colour') || attrStr.includes('shade')) {
                if (select.selectedIndex >= 0) {
                    const txt = select.options[select.selectedIndex].innerText.trim();
                    if (txt && !/select|choose/i.test(txt)) return txt;
                }
            }
        }

        // 2. Check checked radio input
        const radios = Array.from(document.querySelectorAll('input[type="radio"]:checked'));
        for (let r of radios) {
            const attr = (r.id + ' ' + r.className + ' ' + r.name).toLowerCase();
            if (attr.includes('color') || attr.includes('colour')) {
                let labelText = '';
                if (r.id) {
                    const label = document.querySelector(`label[for="${r.id}"]`);
                    if (label) labelText = label.innerText.trim();
                }
                if (!labelText) {
                    const parent = r.closest('label');
                    if (parent) labelText = parent.innerText.trim();
                }
                if (labelText) return labelText;
            }
        }

        // 3. Check active swatch in color containers
        const colorContainers = document.querySelectorAll('[class*="color" i], [id*="color" i], [class*="colour" i], [id*="colour" i], [class*="swatch" i]');
        for (let container of colorContainers) {
            const activeItem = container.querySelector('[class*="active" i], [class*="selected" i], [class*="checked" i], [aria-checked="true"]');
            if (activeItem) {
                if (activeItem.tagName === 'IMG') {
                    const val = activeItem.getAttribute('alt') || activeItem.getAttribute('title');
                    if (val) return val.trim();
                }
                const title = activeItem.getAttribute('title') || activeItem.getAttribute('aria-label') || activeItem.innerText.trim();
                if (title && title.length < 25 && !/color|colour/i.test(title)) return title.trim();
            }
        }

        // 4. Look for text labels indicating color, e.g. "Color: Red"
        const labels = Array.from(document.querySelectorAll('p, span, div, label'));
        for (let l of labels) {
            if (l.childElementCount === 0 && /^(?:color|colour|selected color|selected colour)\s*:\s*(.+)$/i.test(l.innerText)) {
                const match = l.innerText.match(/^(?:color|colour|selected color|selected colour)\s*:\s*(.+)$/i);
                if (match && match[1].trim().length < 25) return match[1].trim();
            }
        }

        return "";
    }
}
