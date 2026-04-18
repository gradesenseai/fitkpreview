// Image and video protection - disable right-click, drag, and long-press save
(function() {
  // Disable right-click on images and videos
  document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
    }
  });

  // Disable drag on images and videos
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
    }
  });
})();
