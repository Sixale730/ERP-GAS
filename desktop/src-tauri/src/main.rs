// Evita que en release abra la consola en Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cuanty_erp_lib::run()
}
