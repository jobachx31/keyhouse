/**
 * Databytes Keyhouse — Popup Logic
 *
 * Implements login via account email + passphrase, connects to the shared storage backend,
 * decrypts credentials locally, and provides 1-click autofill for the active webpage.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const lockedView = document.getElementById('lockedView');
  const unlockedView = document.getElementById('unlockedView');
  const emailInput = document.getElementById('emailInput');
  const passphraseInput = document.getElementById('passphraseInput');
  const togglePassEye = document.getElementById('togglePassEye');
  const apiOriginInput = document.getElementById('apiOriginInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const unlockError = document.getElementById('unlockError');
  const lockVaultBtn = document.getElementById('lockVaultBtn');
  const currentOrigin = document.getElementById('currentOrigin');
  const loginList = document.getElementById('loginList');

  let activeTabUrl = '';

  // Toggle show/hide passphrase
  togglePassEye.addEventListener('click', () => {
    if (passphraseInput.type === 'password') {
      passphraseInput.type = 'text';
      togglePassEye.textContent = '🔒';
    } else {
      passphraseInput.type = 'password';
      togglePassEye.textContent = '👁';
    }
  });

  // Pre-load saved email from storage
  chrome.storage.local.get(['userEmail', 'apiOrigin'], (data) => {
    if (data && data.userEmail) {
      emailInput.value = data.userEmail;
    }
    if (data && data.apiOrigin) {
      apiOriginInput.value = data.apiOrigin;
    }
  });

  // Query active tab URL / IP
  if (chrome && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        activeTabUrl = tabs[0].url;
        try {
          const u = new URL(activeTabUrl);
          currentOrigin.textContent = u.hostname;
        } catch (e) {
          currentOrigin.textContent = activeTabUrl;
        }
      }
      checkStatus();
    });
  } else {
    checkStatus();
  }

  function checkStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.isUnlocked) {
        showUnlockedView(response.userEmail);
      } else {
        showLockedView();
      }
    });
  }

  function showLockedView() {
    lockedView.classList.remove('hidden');
    unlockedView.classList.add('hidden');
    lockVaultBtn.classList.add('hidden');
    passphraseInput.focus();
  }

  function showUnlockedView(email) {
    lockedView.classList.add('hidden');
    unlockedView.classList.remove('hidden');
    lockVaultBtn.classList.remove('hidden');

    loadMatchingLogins();
  }

  function loadMatchingLogins() {
    chrome.runtime.sendMessage({ type: 'GET_MATCHING_LOGINS', url: activeTabUrl }, (res) => {
      loginList.innerHTML = '';

      if (!res || !res.logins || res.logins.length === 0) {
        loginList.innerHTML = `
          <div style="text-align: center; color: #737373; padding: 30px 10px;">
            <div style="font-weight: 700; color: #171717; font-size: 13px; margin-bottom: 4px;">No Logins for this Site</div>
            <p style="font-size: 11px; line-height: 1.4;">When you sign up or log in on this webpage, Keyhouse will automatically ask to save your credentials to your vault.</p>
          </div>
        `;
        return;
      }

      res.logins.forEach((login) => {
        const card = document.createElement('div');
        card.className = 'credential-card';
        card.innerHTML = `
          <div class="credential-title">${escapeHtml(login.name || 'Login')}</div>
          <div class="credential-meta">${escapeHtml(login.username || 'No username')}</div>
          <div class="btn-group">
            <button class="btn-secondary copy-user-btn">Copy User</button>
            <button class="btn-secondary copy-pass-btn">Copy Pass</button>
            <button class="btn-primary fill-btn" style="padding: 6px 12px; font-size: 11px; width: auto; flex: 1.2;">Autofill</button>
          </div>
        `;

        card.querySelector('.copy-user-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(login.username);
          flashButton(card.querySelector('.copy-user-btn'), 'Copied!');
        });

        card.querySelector('.copy-pass-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(login.password);
          flashButton(card.querySelector('.copy-pass-btn'), 'Copied!');
        });

        card.querySelector('.fill-btn').addEventListener('click', () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (u, p) => {
                  const passInput = document.querySelector('input[type="password"]');
                  if (passInput) {
                    passInput.value = p;
                    passInput.dispatchEvent(new Event('input', { bubbles: true }));
                    passInput.dispatchEvent(new Event('change', { bubbles: true }));

                    const form = passInput.closest('form') || document;
                    const userInput = form.querySelector('input[type="text"], input[type="email"], input[autocomplete*="username"]');
                    if (userInput && u) {
                      userInput.value = u;
                      userInput.dispatchEvent(new Event('input', { bubbles: true }));
                      userInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }
                },
                args: [login.username, login.password]
              });
              flashButton(card.querySelector('.fill-btn'), 'Filled ✓');
            }
          });
        });

        loginList.appendChild(card);
      });
    });
  }

  function flashButton(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => {
      btn.textContent = orig;
    }, 1200);
  }

  unlockBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const pass = passphraseInput.value.trim();
    const apiOrigin = apiOriginInput.value.trim();

    if (!email) {
      unlockError.textContent = 'Please enter your account email.';
      unlockError.classList.remove('hidden');
      return;
    }

    if (!pass) {
      unlockError.textContent = 'Please enter your vault unlock passphrase.';
      unlockError.classList.remove('hidden');
      return;
    }

    unlockError.classList.add('hidden');
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Connecting & Decrypting...';

    chrome.runtime.sendMessage(
      {
        type: 'LOGIN_AND_UNLOCK',
        email,
        passphrase: pass,
        apiOrigin
      },
      (res) => {
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Sign In & Unlock Vault';

        if (res && res.success) {
          passphraseInput.value = '';
          showUnlockedView(email);
        } else {
          unlockError.textContent = (res && res.error) || 'Incorrect passphrase or backend connection failed.';
          unlockError.classList.remove('hidden');
        }
      }
    );
  });

  lockVaultBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }, () => {
      showLockedView();
    });
  });

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
