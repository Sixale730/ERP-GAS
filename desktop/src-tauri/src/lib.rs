use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

/// Script inyectado en la ventana principal.
/// Captura Ctrl/Cmd+click, middle-click y target="_blank" en <a>, ademas de window.open,
/// y los redirige al comando Rust `open_external` que abre la URL en el navegador del SO.
const NEW_WINDOW_HOOK: &str = r#"
(function() {
  if (window.__cuantyHookInstalled) return;
  window.__cuantyHookInstalled = true;

  function invoke(url) {
    if (!url) return;
    if (!window.__TAURI_INTERNALS__ || !window.__TAURI_INTERNALS__.invoke) {
      console.warn('[cuanty-desktop] __TAURI_INTERNALS__.invoke not available');
      return;
    }
    window.__TAURI_INTERNALS__.invoke('open_external', { url: url })
      .catch(function(e) { console.error('[cuanty-desktop] open_external failed', e); });
  }

  function resolveHref(a) {
    var href = a.href;
    if (!href) return null;
    if (href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return null;
    return href;
  }

  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest && e.target.closest('a');
    if (!a) return;
    var ctrl = e.ctrlKey || e.metaKey;
    var blank = a.target === '_blank';
    if (!(ctrl || blank)) return;
    var href = resolveHref(a);
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    invoke(href);
  }, true);

  document.addEventListener('auxclick', function(e) {
    if (e.button !== 1) return;
    var a = e.target && e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = resolveHref(a);
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    invoke(href);
  }, true);

  var origOpen = window.open;
  window.open = function(url) {
    if (url) {
      var resolved = url;
      try { resolved = new URL(url, window.location.href).href; } catch (_) {}
      invoke(resolved);
      return null;
    }
    return origOpen.apply(window, arguments);
  };

  console.info('[cuanty-desktop] hook instalado');
})();
"#;

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| format!("opener.open_url fallo: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let toggle = Shortcut::new(
                        Some(Modifiers::CONTROL | Modifiers::SHIFT),
                        Code::KeyC,
                    );
                    if shortcut == &toggle {
                        if let Some(window) = app.get_webview_window("main") {
                            match window.is_visible() {
                                Ok(true) => {
                                    let _ = window.hide();
                                }
                                _ => {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![open_external])
        .setup(|app| {
            // Inyectar el hook en la ventana principal una vez que el documento este listo.
            if let Some(main) = app.get_webview_window("main") {
                let main_for_eval = main.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let _ = main_for_eval.eval(NEW_WINDOW_HOOK);
                });
            }

            let toggle = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::KeyC,
            );
            app.global_shortcut().register(toggle)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
