// ConoBot desktop shell.
//
// Responsibilities:
//   * frameless window lifecycle (close-to-tray, global quick summon)
//   * system tray with quick actions
//   * registering every native command used by the React frontend
//
// The network layer lives in `llm.rs`, persistence in `store.rs`.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod llm;
mod store;

use std::sync::Arc;

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Bring the window to the foreground and ask the UI to focus the composer.
fn focus_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.emit("app:quick-chat", ());
    }
}

/// Toggle the window — bound to Cmd/Ctrl+Shift+Space and the tray icon.
fn summon(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        let focused = window.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = window.hide();
        } else {
            focus_window(app);
        }
    }
}

/// Hide the main window without exiting the process.
fn hide_to_tray(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Close behaviour: the first time the window is closed we explain, in a native
/// dialog, that ConoBot keeps running in the tray. Users who expect "close" to
/// mean "quit" get an explicit choice instead of a window that vanishes.
fn request_close(app: &AppHandle) {
    let marker = app
        .path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("tray-hint-shown"));

    let Some(marker) = marker else {
        hide_to_tray(app);
        return;
    };

    if marker.exists() {
        hide_to_tray(app);
        return;
    }

    if let Some(parent) = marker.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&marker, b"1");

    let handle = app.clone();
    app.dialog()
        .message(
            "ConoBot keeps running in the system tray so your chats stay warm and \
             Ctrl+Shift+Space keeps working.\n\nReopen it from the tray icon, or \
             choose Quit to exit completely.",
        )
        .title("ConoBot is still running")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Keep running in tray".into(),
            "Quit ConoBot".into(),
        ))
        .show(move |keep_running| {
            if keep_running {
                hide_to_tray(&handle);
            } else {
                handle.exit(0);
            }
        });
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show ConoBot", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "new", "New conversation", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit ConoBot", true, None::<&str>)?;
    let items: [&dyn IsMenuItem<tauri::Wry>; 4] = [&show, &quick, &separator, &quit];
    let menu = Menu::with_items(app, &items)?;

    let mut builder = TrayIconBuilder::with_id("conobot-tray")
        .menu(&menu)
        // Left click restores the window (what people expect); right click is the menu.
        .show_menu_on_left_click(false)
        .tooltip("ConoBot — local-first AI coding cockpit")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => focus_window(app),
            "new" => {
                focus_window(app);
                let _ = app.emit("app:new-chat", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let target = url.trim();
    if !(target.starts_with("https://")
        || target.starts_with("http://")
        || target.starts_with("mailto:"))
    {
        return Err("Only http(s) and mailto links can be opened.".into());
    }
    open::that(target).map_err(|error| format!("Could not open the link: {error}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        summon(app);
                    }
                })
                .build(),
        )
        .manage(Arc::new(llm::StreamRegistry::default()))
        .invoke_handler(tauri::generate_handler![
            llm::start_chat_stream,
            llm::stop_generation,
            llm::test_connection,
            store::load_store,
            store::save_store,
            store::store_location,
            store::write_text_file,
            open_external_url
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            build_tray(&handle)?;

            // Global quick-summon. Non-fatal on window managers that refuse it.
            if let Err(error) = app.global_shortcut().register("CmdOrCtrl+Shift+Space") {
                eprintln!("[conobot] could not register Cmd/Ctrl+Shift+Space: {error}");
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("ConoBot");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Close hides to the tray, with a one-time native explanation.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                request_close(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to launch ConoBot");
}
