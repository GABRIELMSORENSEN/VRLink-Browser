# VRLink Browser

Navegador Windows leve, com Google como início, bloqueio local de anúncios/rastreadores e um painel flutuante no canto para enviar **links diretos de vídeo autorizados** ao VRChat.

## Uso

1. Abra uma página ou pesquise pelo Google.
2. Quando a própria página expuser um `<video>` com URL direta (`.mp4`, `.webm`, `.mov`, `.m4v`, `.ogv` ou `.m3u8`), o botão **VR** mostra a quantidade encontrada.
3. Abra o painel no canto e use **Copiar link**. Cole a URL no player de vídeo de um mundo VRChat compatível.

O botão **Abrir VRChat** apenas tenta entregar a URL direta ao protocolo instalado; players de mundos são os responsáveis pela reprodução.

## Limites importantes

- Não baixa vídeos, não grava streams, não remove DRM e não contorna login, cookies, tokens ou paywalls.
- Serviços que usam DRM, `blob:` URLs, players proprietários ou URLs temporárias não expõem uma mídia reutilizável e não aparecem como link VRChat.
- Use somente mídia que você possui ou tem autorização para exibir. A compatibilidade depende das permissões e formatos aceitos pelo mundo VRChat.

## Privacidade

- Não há telemetria, conta, proxy próprio nem envio do histórico para este projeto.
- O bloqueio é local e interrompe domínios comuns de anúncios e rastreamento antes da requisição.
- Sites visitados continuam sujeitos às suas próprias políticas e conexões.

## Desenvolver

```powershell
npm install
npm test
npm start
npm run dist:win
```

O pacote Windows sai em `dist/`. Extraia o ZIP inteiro e abra `VRLink Browser.exe`; não mova somente o executável, pois ele usa os arquivos da pasta `resources/`. Requer Windows 10/11 64-bit.

## Arquitetura

- Electron/Chromium isolado: a UI não tem acesso Node.
- `BrowserView` navega páginas; a barra e o painel ficam fora da página.
- Detector lê somente elementos de vídeo já expostos pelo DOM.
- Regras de privacidade em `src/rules.js` são simples, auditáveis e testadas.

Licença [MIT](LICENSE).
