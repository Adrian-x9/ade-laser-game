import './style.css';
import { StateManager } from './state/StateManager';
import { UIController } from './ui/UIController';
import { GameEngine } from './core/GameEngine';

// Nasłuchujemy beforeinstallprompt PRZED DOMContentLoaded –
// przeglądarka może go wyemitować bardzo wcześnie
let deferredInstallPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

document.addEventListener('DOMContentLoaded', () => {
  const stateManager = new StateManager();
  const uiController = new UIController('app');
  const game = new GameEngine(stateManager, uiController);
  game.boot();

  initInstallBanner();
});

// ---------------------------------------------------------------------------
// PWA INSTALL BANNER
// Pokazuje się jednorazowo użytkownikom którzy jeszcze nie zainstalowali apki.
// Android: przycisk "Zainstaluj" uruchamia natywny prompt Chrome.
// iOS:     wskazówka "Udostępnij → Dodaj do ekranu głównego".
// ---------------------------------------------------------------------------
function getInstallTexts(platform: 'ios' | 'android'): { msg: string; btn: string } {
  const code = (navigator.languages?.[0] || navigator.language || 'en').slice(0, 2).toLowerCase();
  const copy: Record<string, Record<'ios' | 'android', { msg: string; btn: string }>> = {
    pl: {
      ios:     { msg: 'Dodaj do ekranu głównego: kliknij ⬆️ Udostępnij → Dodaj', btn: '' },
      android: { msg: 'Zainstaluj ade BEAMS na swoim telefonie', btn: 'Zainstaluj' }
    },
    de: {
      ios:     { msg: 'Zum Startbildschirm: ⬆️ Teilen → Zum Home-Bildschirm', btn: '' },
      android: { msg: 'ade BEAMS auf deinem Gerät installieren', btn: 'Installieren' }
    },
    en: {
      ios:     { msg: 'Add to Home Screen: tap ⬆️ Share → Add to Home Screen', btn: '' },
      android: { msg: 'Install ade BEAMS on your device', btn: 'Install' }
    }
  };

  return (copy[code] ?? copy.en)[platform];
}

function initInstallBanner(): void {
  // Nie pokazujemy jeśli apka już działa w trybie standalone (zainstalowana)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  if (isStandalone) return;

  // Nie pokazujemy jeśli użytkownik już odrzucił banner
  if (localStorage.getItem('install_dismissed')) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Tworzymy element bannera i dodajemy do body (poza #app)
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner hidden';
  document.body.appendChild(banner);

  const dismiss = () => {
    banner.classList.add('hidden');
    localStorage.setItem('install_dismissed', '1');
  };

  // --- Android (Chrome): czekamy na deferredInstallPrompt ---
  if (deferredInstallPrompt) {
    showAndroidBanner(banner, deferredInstallPrompt, dismiss);
  } else if (!isIOS) {
    // Chrome może jeszcze nie wyemitować eventu – czekamy chwilę
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      showAndroidBanner(banner, e, dismiss);
    }, { once: true });
  }

  // --- iOS Safari: ręczne instrukcje ---
  if (isIOS) {
    showIOSBanner(banner, dismiss);
  }
}

function showAndroidBanner(banner: HTMLElement, promptEvent: any, dismiss: () => void): void {
  const { msg, btn } = getInstallTexts('android');
  banner.innerHTML = `
    <span class="install-banner-icon">📲</span>
    <span class="install-banner-msg">${msg}</span>
    <button class="install-banner-btn" id="install-action-btn">${btn}</button>
    <button class="install-banner-dismiss" id="install-dismiss-btn" aria-label="Zamknij">✕</button>
  `;
  banner.classList.remove('hidden');

  document.getElementById('install-action-btn')?.addEventListener('click', async () => {
    promptEvent.prompt();
    await promptEvent.userChoice;
    dismiss();
  });

  document.getElementById('install-dismiss-btn')?.addEventListener('click', dismiss);
}

function showIOSBanner(banner: HTMLElement, dismiss: () => void): void {
  const { msg } = getInstallTexts('ios');
  banner.innerHTML = `
    <span class="install-banner-icon">📲</span>
    <span class="install-banner-msg">${msg}</span>
    <button class="install-banner-dismiss" id="install-dismiss-btn" aria-label="Zamknij">✕</button>
  `;
  banner.classList.remove('hidden');

  document.getElementById('install-dismiss-btn')?.addEventListener('click', dismiss);
}

// ===========================================================================
// GLOBALNE FUNKCJE PWA (Wywoływane z modalu Info oraz konsoli)
// ===========================================================================
declare global {
  interface Window {
    __beamsInstall?: () => void;
    __beamsResetBanner?: () => void;
  }
}

window.__beamsInstall = async () => {
  // 1. Jeśli przeglądarka (Android/PC Chrome) udostępniła natywny obiekt instalacji
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      // Ukrywamy przycisk po udanej instalacji
      const installBtn = document.getElementById('btn-modal-install');
      if (installBtn) installBtn.style.display = 'none';
    }
  } else {
    // 2. Obsługa fallbacku (iOS Safari blokuje monity, a na PC apka może być już zainstalowana)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isPL = (document.getElementById('btn-lang')?.textContent || '').includes('PL');

    if (isIOS) {
      alert(isPL 
        ? "📌 Aby zainstalować grę na iPhonie (iOS):\n\n1. Dotknij ikony 'Udostępnij' (kwadrat ze strzałką w górę) na dolnym pasku Safari.\n2. Przewiń listę w dół i wybierz opcję 'Do ekranu początkowego'."
        : "📌 To install on iPhone (iOS):\n\n1. Tap the Share icon (square with arrow) at the bottom of Safari.\n2. Scroll down and select 'Add to Home Screen'."
      );
    } else {
      alert(isPL
        ? "💡 Aplikacja jest już zainstalowana lub przeglądarka nie wspiera automatycznego monitu.\n\nNa komputerze (Chrome/Edge) poszukaj ikony instalacji (ekran ze strzałką lub plus) po prawej stronie paska adresu URL."
        : "💡 App is already installed or your browser blocks auto-prompts.\n\nOn Desktop Chrome/Edge, look for the install icon at the right end of your URL address bar."
      );
    }
  }
};

window.__beamsResetBanner = () => {
  localStorage.removeItem('install_dismissed');
  const oldBanner = document.getElementById('install-banner');
  if (oldBanner) oldBanner.remove();
  initInstallBanner();
};

// Opcjonalne podpięcie starych aliasów (w razie starych nawyków w konsoli)
window.__zipInstall = window.__beamsInstall;
window.__zipResetBanner = window.__beamsResetBanner;