export class LoginPage {
  constructor(page) {
    this.page = page
    this.usuario = page.getByPlaceholder('Usuario o correo')
    this.clave = page.getByPlaceholder('Contraseña')
    this.entrar = page.getByRole('button', { name: 'Entrar' })
    this.error = page.locator('.login-card .error')
  }

  async goto() {
    await this.page.goto('/')
  }

  async login(usuario, clave) {
    if (!usuario || !clave) {
      throw new Error(
        'Faltan credenciales de prueba. Copia .env.example a .env y completa E2E_USERNAME / E2E_PASSWORD.'
      )
    }
    await this.usuario.fill(usuario)
    await this.clave.fill(clave)
    await this.entrar.click()
  }
}
