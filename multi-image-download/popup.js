// popup.js
class ImageGallery {
  constructor() {
    this.images = [];
    this.selectedImages = new Set();
    this.filters = {
      minWidth: 0,
      minHeight: 0,
      aspectRatio: null
    };

    this.initUI();
    this.loadImages();
  }

  initUI() {
    // 初始化按钮事件
    document.getElementById('selectAll').addEventListener('click', () => this.toggleSelectAll());
    document.getElementById('download').addEventListener('click', () => this.downloadSelected());

    // 初始化筛选器
    ['minWidth', 'minHeight', 'aspectRatio'].forEach(id => {
      const element = document.getElementById(id);
      element.addEventListener('change', (e) => {
        this.updateFilters({ [id]: e.target.value });
      });
      element.addEventListener('input', (e) => {
        this.updateFilters({ [id]: e.target.value });
      });
    });

    // 初始化预览模态框关闭事件
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('preview-modal')) {
        this.closePreview();
      }
    });

    // 初始化键盘事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePreview();
      }
    });

    // 创建下载状态提示
    this.downloadStatus = document.createElement('div');
    this.downloadStatus.className = 'download-status';
    document.body.appendChild(this.downloadStatus);
  }

  async loadImages() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found');
      }

      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading';
      loadingEl.textContent = '加载中...';
      document.getElementById('waterfall').appendChild(loadingEl);

      const progressBar = document.getElementById('progressBar');
      progressBar.style.width = '0%'; // Initialize progress bar

      chrome.tabs.sendMessage(tab.id, { type: 'GET_IMAGES' }, (response) => {
        if (chrome.runtime.lastError) {
          this.showError('页面未完全加载，请刷新或稍后');
          progressBar.style.backgroundColor = '#ff4444'; // Indicate error
          return;
        }

        if (response && response.images) {
          this.images = response.images;
          const totalImages = this.images.length;
          let loadedImages = 0;

          // Update progress bar after each image is processed
          const updateProgress = () => {
            loadedImages++;
            const progress = (loadedImages / totalImages) * 100;
            progressBar.style.width = `${progress}%`;

            if (loadedImages === totalImages) {
              // Optional: Add a slight delay before resetting for visual feedback
              setTimeout(() => {
                progressBar.style.width = '0%';
              }, 1000);
              this.renderImages();
            }
          };
          
          // Simulate image processing (replace with actual image loading if needed)
          this.images.forEach(() => {
            setTimeout(updateProgress, 0)
          });

        } else {
          this.showError('未能获取页面图片');
          progressBar.style.backgroundColor = '#ff4444'; // Indicate error
        }
      });
    } catch (error) {
      this.showError(error.message);
      progressBar.style.backgroundColor = '#ff4444'; // Indicate error
    }
  }

  showError(message) {
    const waterfall = document.getElementById('waterfall');
    waterfall.innerHTML = `
      <div class="error">
        <p>${message}</p>
        <button id="retryBtn">重试</button>
      </div>
    `;
    // 动态绑定点击事件
    document.getElementById('retryBtn').addEventListener('click', () => {
      // 刷新当前活动的标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.reload(tabs[0].id, () => {
            // 刷新弹出页面
            window.location.reload();
          });
        } else {
          // 如果无法获取标签页，也刷新弹出页面
          window.location.reload();
        }
      });
    });
  }
  

  renderImages() {
    const waterfall = document.getElementById('waterfall');
    waterfall.innerHTML = '';
    const filteredImages = this.filterImages();

    if (filteredImages.length === 0) {
      waterfall.innerHTML = '<div class="no-images">未找到符合条件的图片</div>';
      return;
    }

    // 使用DocumentFragment优化渲染
    const fragment = document.createDocumentFragment();
    filteredImages.forEach(image => {
      const card = this.createImageCard(image);
      fragment.appendChild(card);
    });
    waterfall.appendChild(fragment);
    this.updateSelectAllButton();
  }

  createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'image-wrapper';

    const img = document.createElement('img');
    img.className = 'image-preview';
    img.src = image.url;
    img.loading = 'lazy';
    img.addEventListener('click', () => this.showPreview(image));

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.checked = this.selectedImages.has(image.url);
    checkbox.addEventListener('change', () => this.toggleSelect(image.url));

    const info = document.createElement('div');
    info.className = 'image-info';
    info.innerHTML = `
      <span>${image.width}x${image.height}</span>
      <span>${this.formatSize(image.size)}</span>
    `;

    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);
    card.appendChild(checkbox);
    card.appendChild(info);

    return card;
  }

  formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  showPreview(image) {
    const preview = document.getElementById('preview');
    preview.className = 'preview-modal active';
    preview.innerHTML = `
      <div class="preview-content">
        <button class="close-preview" onclick="this.closePreview()">×</button>
        <img src="${image.url}" />
        <div class="preview-info">
          <p>尺寸: ${image.width} x ${image.height}</p>
          <p>比例: ${image.aspectRatio.toFixed(2)}</p>
          <p>类型: ${image.type}</p>
          <p>URL: <a href="${image.url}" target="_blank">${image.url}</a></p>
        </div>
      </div>
    `;
  }

  closePreview() {
    const preview = document.getElementById('preview');
    preview.className = 'preview-modal';
    preview.innerHTML = '';
  }

  filterImages() {
    return this.images.filter(image => {
      if (this.filters.minWidth && image.width < Number(this.filters.minWidth)) return false;
      if (this.filters.minHeight && image.height < Number(this.filters.minHeight)) return false;

      if (this.filters.aspectRatio) {
        const [w, h] = this.filters.aspectRatio.split(':').map(Number);
        if (!w || !h) return true;

        const targetRatio = w / h;
        const tolerance = 0.1;
        const actualRatio = image.width / image.height;
        if (Math.abs(actualRatio - targetRatio) > tolerance) return false;
      }

      return true;
    });
  }

  toggleSelect(url) {
    if (this.selectedImages.has(url)) {
      this.selectedImages.delete(url);
    } else {
      this.selectedImages.add(url);
    }
    this.updateSelectAllButton();
  }

  toggleSelectAll() {
    const filteredImages = this.filterImages();
    const allSelected = filteredImages.every(img => this.selectedImages.has(img.url));

    if (allSelected) {
      filteredImages.forEach(img => this.selectedImages.delete(img.url));
    } else {
      filteredImages.forEach(img => this.selectedImages.add(img.url));
    }

    this.renderImages();
  }

  updateSelectAllButton() {
    const button = document.getElementById('selectAll');
    const filteredImages = this.filterImages();
    const allSelected = filteredImages.every(img => this.selectedImages.has(img.url));

    button.textContent = allSelected ? '取消全选' : '全选';
    button.classList.toggle('all-selected', allSelected);
  }

  async downloadSelected() {
    const selected = Array.from(this.selectedImages);
    if (selected.length === 0) {
      this.showDownloadStatus('请选择要下载的图片', 'error');
      return;
    }
    this.showDownloadStatus(`准备下载 ${selected.length} 张图片...`);

    try {
      for (let i = 0; i < selected.length; i++) {
        const url = selected[i];
        const image = this.images.find(img => img.url === url);
        const filename = this.generateFilename(url, i + 1);
        const imageUrl = image.originalUrl || url;

        await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: imageUrl,
            filename: filename,
            saveAs: selected.length === 1
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(downloadId);
            }
          });
        });
        this.showDownloadStatus(`已下载 ${i + 1}/${selected.length} 张图片`);
      }

      this.showDownloadStatus('下载完成!', 'success');
      setTimeout(() => this.hideDownloadStatus(), 2000);
    } catch (error) {
      this.showDownloadStatus('下载过程中发生错误', 'error');
    }
  }

  generateFilename(url, index) {
    const date = new Date().toISOString().split('T')[0];
    const urlParts = new URL(url).pathname.split('/');
    const originalName = urlParts[urlParts.length - 1];
    const ext = originalName.split('.').pop() || 'jpg';

    return `sakura-downloader/${date}/image-${index}.${ext}`;
  }

  showDownloadStatus(message, type = 'info') {
    this.downloadStatus.textContent = message;
    this.downloadStatus.className = `download-status ${type} active`;
  }

  hideDownloadStatus() {
    this.downloadStatus.className = 'download-status';
  }

  updateFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };

    // Validate aspect ratio input
    if (newFilters.aspectRatio) {
      const ratio = newFilters.aspectRatio;
      if (!/^\d+:\d+$/.test(ratio)) {
        alert('Invalid aspect ratio format. Please use the format "width:height", e.g., "16:9".');
        document.getElementById('aspectRatio').value = this.filters.aspectRatio || ''; // Reset to previous valid value or empty
        return;
      }
    }

    this.renderImages();
  }
}

// 初始化图片
document.addEventListener('DOMContentLoaded', () => {
  new ImageGallery();
});
