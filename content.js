class ImageDetector {
  constructor() {
    this.db = null;
    this.initDB();
    this.initMessageListener();
  }

  async initDB() {
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ImageCache', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore('images', { keyPath: 'url' });
      };
    });
  }

  initMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_IMAGES') {
        this.detectImages().then(images => {
          sendResponse({ images: images });
        });
        return true;
      }
    });
  }

  async detectImages() {
    const images = [];
    const seen = new Set();

    // 获取所有图片元素
    const imgElements = document.querySelectorAll('img');
    for (const img of imgElements) {
      let url = null;
      if (img.srcset) {
        const srcset = img.srcset;
        const sources = srcset.split(',').map(s => s.trim());
        let bestSource = null;
        let bestWidth = 0;

        for (const source of sources) {
          const parts = source.split(' ').filter(p => p !== '');
          const sourceUrl = parts[0];
          const widthDescriptor = parts[1];

          if (widthDescriptor && widthDescriptor.endsWith('w')) {
            const width = parseInt(widthDescriptor.slice(0, -1));
            if (width > bestWidth) {
              bestWidth = width;
              bestSource = sourceUrl;
            }
          }
        }

        if (bestSource) {
          url = this.getImageUrl(bestSource);
        } else {
          url = this.getImageUrl(img.src);
        }
      } else {
        url = this.getImageUrl(img.src);
      }

      if (url && !seen.has(url)) {
        seen.add(url);
        const dimensions = await this.getImageDimensions(url);
        if (dimensions && dimensions.width >= 100 && dimensions.height >= 100) {
          images.push({
            url: url,
            width: dimensions.width,
            height: dimensions.height,
            aspectRatio: dimensions.width / dimensions.height,
            type: 'image',
            originalUrl: img.srcset ? bestSource : img.src
          });
        }
      }
    }

    // 处理背景图片
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      if (backgroundImage && backgroundImage !== 'none') {
        const url = this.getImageUrl(backgroundImage);
        if (url && !seen.has(url)) {
          seen.add(url);
          const dimensions = await this.getImageDimensions(url);
          if (dimensions && dimensions.width >= 100 && dimensions.height >= 100) {
            images.push({
              url: url,
              width: dimensions.width,
              height: dimensions.height,
              aspectRatio: dimensions.width / dimensions.height,
              type: 'background',
              originalUrl: backgroundImage
            });
          }
        }
      }
    }

    return images;
  }

  getImageUrl(src) {
    try {
      if (!src) return null;
      if (src.startsWith('data:')) return null;
      
      // 处理 background-image
      if (src.startsWith('url(')) {
        src = src.slice(4, -1).replace(/['"]/g, '');
      }
      
      // 处理相对路径
      const url = new URL(src, window.location.href);
      return url.href;
    } catch (e) {
      return null;
    }
  }

  async getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}

new ImageDetector();
