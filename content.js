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

    function getSizes() {
        let sizes = [];

        // 0. Zara & Fast-Fashion Specific Selector Check
        const zaraSizeEls = document.querySelectorAll(`
            [class*="product-detail-size" i] li,
            [class*="size-selector" i] li,
            [data-qa-action*="size" i],
            [data-qa-qualifier*="size" i],
            .product-detail-size-selector__size-list-item,
            button[class*="size-selector" i],
            [class*="size-item" i]
        `);

        if (zaraSizeEls.length > 0) {
            zaraSizeEls.forEach(el => {
                let txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                if (txt && txt.length < 30 && !/^(?:size guide|find your size|check in-store|what is my size|view size chart|size)$/i.test(txt)) {
                    sizes.push(txt);
                }
            });
            if (sizes.length > 0) return [...new Set(sizes)].slice(0, 20);
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
                        .filter(txt => txt && !/^(?:select|choose|select a size|size)$/i.test(txt));
                } else {
                    const optEls = select.querySelectorAll('option, [role="option"], li, button, span[class*="size"]');
                    options = Array.from(optEls)
                        .map(opt => (opt.innerText || opt.textContent || '').replace(/\s+/g, ' ').trim())
                        .filter(txt => txt && !/^(?:select|choose|select a size|size|size guide)$/i.test(txt));
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
                    if (labelText) sizes.push(labelText);
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
                    .filter(txt => txt && txt.length > 0 && txt.length < 30 && !/^(?:select|size|choose a size|size guide|find your size)$/i.test(txt));
                if (textOptions.length > 0 && textOptions.length < 40) {
                    sizes = [...new Set(textOptions)];
                    break;
                }
            }
        }

        // 4. Check JSON-LD schema tags for size variants
        if (sizes.length === 0) {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (let script of scripts) {
                try {
                    const data = JSON.parse(script.innerText);
                    const items = Array.isArray(data) ? data : [data];
                    for (let item of items) {
                        if (item.offers) {
                            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                            offers.forEach(off => {
                                if (off.name && !/^(?:select|size)$/i.test(off.name)) sizes.push(off.name);
                            });
                        }
                        if (item.hasVariant) {
                            item.hasVariant.forEach(v => {
                                if (v.size) sizes.push(v.size);
                                else if (v.name) sizes.push(v.name);
                            });
                        }
                    }
                } catch(e) {}
            }
        }

        // 5. Fallback to activeSize if sizes array is empty
        if (sizes.length === 0) {
            const active = getActiveSize();
            if (active) sizes = [active];
        }
        
        return [...new Set(sizes)].slice(0, 20);
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
