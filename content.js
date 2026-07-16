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
        // 1. Check select elements
        const selects = Array.from(document.querySelectorAll('select'));
        for (let select of selects) {
            const attrStr = (select.id + ' ' + select.className + ' ' + select.name + ' ' + (select.getAttribute('aria-label') || '')).toLowerCase();
            if (attrStr.includes('size') || attrStr.includes('dimension')) {
                const options = Array.from(select.options)
                    .map(opt => opt.innerText.trim())
                    .filter(txt => txt && !/select|choose/i.test(txt));
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
        
        // 3. Check for elements inside size containers
        if (sizes.length === 0) {
            const sizeContainers = document.querySelectorAll('[class*="size" i], [id*="size" i], [class*="dimension" i]');
            for (let container of sizeContainers) {
                const items = Array.from(container.querySelectorAll('button, li, [role="radio"], .swatch, [class*="item"], [class*="value"]'));
                const textOptions = items
                    .map(item => item.innerText.trim())
                    .filter(txt => txt && txt.length > 0 && txt.length < 15 && !/select|size/i.test(txt));
                if (textOptions.length > 0 && textOptions.length < 30) {
                    sizes = [...new Set(textOptions)];
                    break;
                }
            }
        }
        
        return [...new Set(sizes)].slice(0, 15);
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
