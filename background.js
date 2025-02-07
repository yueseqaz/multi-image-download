chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_IMAGE') {
    chrome.downloads.download({
      url: message.data.url,
      filename: message.data.filename || `sakura-downloader/${Date.now()}.jpg`,
      headers: [
        {
          name: 'Referer',
          value: sender.tab ? sender.tab.url : ''
        }
      ]
    });
  }
});