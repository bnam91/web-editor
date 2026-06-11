// Card image upload group — extracted from image-handling.js (Phase 1)
import { showAssetLoading, hideAssetLoading } from './image-handling.js';

function triggerCardImageUpload(cdb) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) loadImageToCard(cdb, file);
  };
  input.click();
}

function loadImageToCard(cdb, file) {
  if (!file || !file.type.startsWith('image/')) return;
  pushHistory();
  showAssetLoading(cdb);
  const reader = new FileReader();
  reader.onload = ev => {
    hideAssetLoading(cdb);
    const src = ev.target.result;
    const imageArea = cdb.querySelector('.cdb-image');
    cdb.classList.add('has-image');
    cdb.dataset.imgSrc = src;
    imageArea.innerHTML = `
      <img class="cdb-img" src="${src}" draggable="false">
      <button class="cdb-clear-btn" title="이미지 제거">✕</button>`;
    imageArea.querySelector('.cdb-clear-btn').addEventListener('click', e => {
      e.stopPropagation();
      clearCardImage(cdb);
    });
    showCardProperties(cdb);
  };
  reader.onerror = () => hideAssetLoading(cdb);
  reader.readAsDataURL(file);
}

function clearCardImage(cdb) {
  pushHistory();
  cdb.classList.remove('has-image');
  delete cdb.dataset.imgSrc;
  const imageArea = cdb.querySelector('.cdb-image');
  imageArea.innerHTML = `<span class="cdb-img-placeholder">+</span>`;
  showCardProperties(cdb);
}

window.triggerCardImageUpload = triggerCardImageUpload;
window.loadImageToCard        = loadImageToCard;
window.clearCardImage         = clearCardImage;
