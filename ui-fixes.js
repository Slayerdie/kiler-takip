// Kiler Takip v1.1.1 - iPhone sheet close + swipe-down behavior
(() => {
  const closeDialog = dialog => {
    if (!dialog || typeof dialog.close !== 'function') return;
    const sheet = dialog.querySelector('.sheet');
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
      sheet.style.opacity = '';
    }
    dialog.close('cancel');
  };

  // Close buttons must always close their parent dialog, even on iOS/PWA.
  document.addEventListener('click', event => {
    const btn = event.target.closest('.close-btn');
    if (!btn) return;
    const dialog = btn.closest('dialog');
    if (!dialog) return;
    event.preventDefault();
    event.stopPropagation();
    closeDialog(dialog);
  }, true);

  // Swipe the top of a bottom sheet down to dismiss it.
  document.querySelectorAll('.sheet-dialog').forEach(dialog => {
    const sheet = dialog.querySelector('.sheet');
    if (!sheet) return;

    let startY = 0;
    let deltaY = 0;
    let dragging = false;

    const canStart = target => {
      if (target.closest('button,input,select,textarea,label,a')) return false;
      return Boolean(target.closest('.sheet-grabber,.sheet-head'));
    };

    sheet.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || !canStart(e.target)) return;
      startY = e.touches[0].clientY;
      deltaY = 0;
      dragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });

    sheet.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      deltaY = Math.max(0, e.touches[0].clientY - startY);
      if (!deltaY) return;
      sheet.style.transform = `translateY(${Math.min(deltaY, 220)}px)`;
      sheet.style.opacity = String(Math.max(.72, 1 - deltaY / 500));
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const finish = () => {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = 'transform .18s ease, opacity .18s ease';
      if (deltaY > 85) {
        sheet.style.transform = 'translateY(110%)';
        sheet.style.opacity = '.7';
        setTimeout(() => closeDialog(dialog), 160);
      } else {
        sheet.style.transform = '';
        sheet.style.opacity = '';
      }
      deltaY = 0;
    };

    sheet.addEventListener('touchend', finish, { passive: true });
    sheet.addEventListener('touchcancel', finish, { passive: true });
  });
})();
