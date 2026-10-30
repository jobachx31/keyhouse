/**
 * Databytes Keyhouse — Content Script
 *
 * 1. Detects sign-in forms on active webpage and displays an autofill popup.
 * 2. Detects sign-up and password submissions and displays a "Save to Vault" prompt.
 */

(function () {
  let matchingLogins = [];
  let isUnlocked = false;
  let activeAutofillBanner = null;
  let activeSavePrompt = null;

  // -------------------------------------------------------------
  // 1. SIGN-IN DETECTION & AUTOFILL POPUP
  // -------------------------------------------------------------

  function checkAndAttachAutofill() {
    try {
      chrome.runtime.sendMessage(
        { type: 'GET_MATCHING_LOGINS', url: window.location.href },
        (response) => {
          if (chrome.runtime.lastError || !response) return;

          isUnlocked = response.isUnlocked;
          matchingLogins = response.logins || [];

          if (isUnlocked && matchingLogins.length > 0) {
            showAutofillBannerIfLoginForm();
            injectInlineKeyIcons();
          }
        }
      );
    } catch (e) {
      // Extension context invalidated or not ready
    }
  }

  function findPasswordInputs() {
    return Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });
  }

  function showAutofillBannerIfLoginForm() {
    const passwordInputs = findPasswordInputs();
    if (passwordInputs.length === 0) return;
    if (document.getElementById('keyhouse-autofill-banner')) return;

    const firstMatch = matchingLogins[0];
    if (!firstMatch) return;

    const banner = document.createElement('div');
    banner.id = 'keyhouse-autofill-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #FFFFFF;
      border: 1px solid #E5E5E5;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Funnel Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
      max-width: 380px;
      animation: keyhouseSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    banner.innerHTML = `
      <style>
        @keyframes keyhouseSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      <div style="width: 32px; height: 32px; border-radius: 8px; background: #008AD6; display: flex; align-items: center; justify-content: center; color: white; shrink: 0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="7.5" cy="15.5" r="5.5"></circle>
          <path d="m21 2-9.6 9.6"></path>
          <path d="m15.5 7.5 3 3L22 7l-3-3"></path>
        </svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 13px; color: #171717; line-height: 1.2;">Autofill Login?</div>
        <div style="font-size: 11px; color: #737373; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
          ${escapeHtml(firstMatch.username || firstMatch.name)}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="keyhouse-autofill-btn" style="background: #171717; color: white; border: none; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;">
          Autofill
        </button>
        <button id="keyhouse-autofill-close" style="background: transparent; border: none; color: #737373; font-size: 16px; cursor: pointer; padding: 4px; display: flex; align-items: center;">
          ✕
        </button>
      </div>
    `;

    document.body.appendChild(banner);
    activeAutofillBanner = banner;

    banner.querySelector('#keyhouse-autofill-btn').addEventListener('click', () => {
      autofillCredentials(firstMatch.username, firstMatch.password);
      const btn = banner.querySelector('#keyhouse-autofill-btn');
      btn.textContent = 'Filled ✓';
      btn.style.background = '#008AD6';
      setTimeout(() => {
        banner.remove();
      }, 1200);
    });

    banner.querySelector('#keyhouse-autofill-close').addEventListener('click', () => {
      banner.remove();
    });
  }

  function autofillCredentials(username, password) {
    const passwordInputs = findPasswordInputs();
    if (passwordInputs.length === 0) return;

    passwordInputs.forEach((passInput) => {
      passInput.value = password;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Find username / email field in the same form or preceding
      const form = passInput.closest('form') || document;
      const userInput = form.querySelector(
        'input[type="text"], input[type="email"], input[autocomplete*="username"], input[name*="user" i], input[name*="email" i], input[id*="user" i]'
      );
      if (userInput && username) {
        userInput.value = username;
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        userInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function injectInlineKeyIcons() {
    const passwordInputs = document.querySelectorAll('input[type="password"]:not([data-keyhouse-injected])');
    passwordInputs.forEach((input) => {
      input.setAttribute('data-keyhouse-injected', 'true');
      input.addEventListener('focus', () => {
        if (matchingLogins.length > 0 && isUnlocked) {
          showAutofillBannerIfLoginForm();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 2. SIGN-UP / PASSWORD SUBMIT DETECTION & SAVE TO VAULT PROMPT
  // -------------------------------------------------------------

  function captureFormInputs(formOrContainer) {
    const passInput = formOrContainer.querySelector('input[type="password"]');
    if (!passInput || !passInput.value.trim()) return null;

    const userInput = formOrContainer.querySelector(
      'input[type="email"], input[type="text"], input[autocomplete*="username"], input[name*="user" i], input[name*="email" i], input[id*="user" i]'
    );

    return {
      username: userInput ? userInput.value.trim() : '',
      password: passInput.value.trim()
    };
  }

  function onFormSubmitDetected(e) {
    const target = e.target;
    let creds = null;

    if (target && target.tagName === 'FORM') {
      creds = captureFormInputs(target);
    } else if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT')) {
      const form = target.closest('form');
      if (form) {
        creds = captureFormInputs(form);
      } else {
        const pass = document.querySelector('input[type="password"]');
        if (pass && pass.value) {
          creds = captureFormInputs(document.body);
        }
      }
    }

    if (creds && creds.password) {
      setTimeout(() => {
        verifyAndPromptSave(creds.username, creds.password);
      }, 300);
    }
  }

  function verifyAndPromptSave(username, password) {
    if (!password) return;

    try {
      chrome.runtime.sendMessage(
        {
          type: 'CHECK_EXISTING_LOGIN',
          url: window.location.href,
          username,
          password
        },
        (res) => {
          if (chrome.runtime.lastError || !res) return;
          // If this login is not already stored, show the save prompt
          if (!res.exists) {
            showSaveToVaultModal(username, password);
          }
        }
      );
    } catch (e) {}
  }

  function showSaveToVaultModal(username, password) {
    if (document.getElementById('keyhouse-save-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'keyhouse-save-modal';
    modal.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #FFFFFF;
      border: 1px solid #E5E5E5;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      padding: 18px 20px;
      font-family: 'Funnel Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
      width: 340px;
      animation: keyhouseSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    modal.innerHTML = `
      <style>
        @keyframes keyhouseSlideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 26px; height: 26px; border-radius: 6px; background: #008AD6; display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5"></circle>
              <path d="m21 2-9.6 9.6"></path>
              <path d="m15.5 7.5 3 3L22 7l-3-3"></path>
            </svg>
          </div>
          <span style="font-weight: 700; font-size: 13px; color: #171717;">Databytes Keyhouse</span>
        </div>
        <button id="keyhouse-save-close" style="background: transparent; border: none; color: #737373; font-size: 16px; cursor: pointer; padding: 2px;">
          ✕
        </button>
      </div>

      <div style="font-weight: 700; font-size: 14px; color: #171717; margin-bottom: 4px;">
        Save password to vault?
      </div>
      <div style="font-size: 11px; color: #737373; margin-bottom: 12px;">
        Encrypt and sync this login with your zero-knowledge storage backend.
      </div>

      <div style="background: #FAFAFA; border: 1px solid #E5E5E5; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-family: monospace; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; color: #737373; margin-bottom: 4px;">
          <span>URL:</span>
          <span style="color: #171717; font-weight: 500;">${window.location.hostname}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #737373; margin-bottom: 4px;">
          <span>User:</span>
          <span style="color: #171717; font-weight: 500;">${escapeHtml(username || 'Account')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; color: #737373;">
          <span>Pass:</span>
          <span id="keyhouse-pass-masked" style="color: #171717; font-weight: 500;">••••••••••••</span>
        </div>
      </div>

      <div id="keyhouse-save-status" style="font-size: 11px; color: #008AD6; margin-bottom: 10px; display: none;"></div>

      <div style="display: flex; gap: 8px;">
        <button id="keyhouse-not-now-btn" style="flex: 1; background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 8px; color: #171717; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Not Now
        </button>
        <button id="keyhouse-save-btn" style="flex: 1.5; background: #171717; color: white; border: none; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Save to Vault
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    activeSavePrompt = modal;

    const saveBtn = modal.querySelector('#keyhouse-save-btn');
    const notNowBtn = modal.querySelector('#keyhouse-not-now-btn');
    const closeBtn = modal.querySelector('#keyhouse-save-close');
    const statusDiv = modal.querySelector('#keyhouse-save-status');

    saveBtn.addEventListener('click', () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      chrome.runtime.sendMessage(
        {
          type: 'SAVE_NEW_LOGIN',
          url: window.location.href,
          username: username,
          password: password,
          siteName: document.title || window.location.hostname
        },
        (res) => {
          if (res && res.success) {
            statusDiv.textContent = '✓ Encrypted and saved to your Keyhouse vault!';
            statusDiv.style.color = '#008AD6';
            statusDiv.style.display = 'block';
            saveBtn.textContent = 'Saved ✓';
            setTimeout(() => {
              modal.remove();
            }, 2000);
          } else {
            statusDiv.textContent = res.error || 'Failed to save to vault.';
            statusDiv.style.color = '#DC2626';
            statusDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save to Vault';
          }
        }
      );
    });

    notNowBtn.addEventListener('click', () => modal.remove());
    closeBtn.addEventListener('click', () => modal.remove());
  }

  // Intercept form submissions
  document.addEventListener('submit', onFormSubmitDetected, true);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"]');
    if (btn) {
      const text = (btn.innerText || btn.value || '').toLowerCase();
      if (
        text.includes('sign in') ||
        text.includes('log in') ||
        text.includes('sign up') ||
        text.includes('register') ||
        text.includes('submit') ||
        text.includes('continue')
      ) {
        onFormSubmitDetected(e);
      }
    }
  }, true);

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // Initial check on page load
  checkAndAttachAutofill();
  setInterval(checkAndAttachAutofill, 3000);
})();
