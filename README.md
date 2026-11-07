# VRLink Browser

Navegador Windows com Google, bloqueio local de anúncios/rastreadores e preparação de links de vídeo para players do VRChat.

## Usar um vídeo no VRChat

1. Abra a página do vídeo e inicie a reprodução no navegador.
2. Clique em **VR** na barra de cima. A captura inclui vídeos do DOM, iframes, requisições de mídia e playlists HLS.
3. Se necessário, clique em **VERIFICAR PÁGINA AGORA**.
4. Na fonte encontrada, clique em **Usar no VRChat**. O app prepara um endereço local, reaproveita temporariamente os cookies, referer e agente de usuário da sessão, e copia o endereço pronto.
5. Cole o endereço copiado no player de vídeo do mundo.

O relay local continua ligado enquanto o VRLink estiver aberto. Playlists HLS têm suas referências reescritas pelo relay. Respostas de vídeo comuns são transmitidas com suporte a Range para permitir seek. Nenhum arquivo é salvo no disco.

## Compatibilidade do mundo

O link é servido em `127.0.0.1` no mesmo PC. No VRChat, habilite **Allow Untrusted URLs** e use um player que aceite URLs HTTP/HLS. Instâncias públicas podem exigir que o proprietário do mundo autorize o domínio; um relay local não funciona para outros participantes em computadores diferentes. Para compartilhar com todos, o vídeo precisa estar num host público aceito pelo mundo.

O relay preserva a resposta original. Se o player rejeitar o codec/contêiner, o link depender de DRM, ou o site não fornecer uma fonte reutilizável, a conversão de formato exige transcodificação ou um host acessível. O app informa o endereço que deve ser testado no próprio player.

## Privacidade

- Captura de cookies e cabeçalhos fica em memória local e é usada apenas para as fontes descobertas.
- O relay escuta somente no endereço de loopback (`127.0.0.1`), usa identificadores aleatórios de curta duração e apaga links antigos ao longo do processo.
- Não há telemetria, conta, upload ou gravação dos vídeos.
- O bloqueador de anúncios e rastreadores opera localmente.

## Desenvolver

```powershell
npm install
npm start
npm run dist:win
```

Extraia o ZIP inteiro e abra `VRLink Browser.exe`. Requer Windows 10/11 64-bit.

## Arquitetura

- Electron/Chromium isolado: a interface não tem acesso direto ao Node.
- `webRequest` observa recursos e captura cabeçalhos temporariamente.
- `preload-page.js` lê vídeo e fonte no DOM.
- `relay.js` transmite o recurso de origem, reescreve playlists HLS e repassa pedidos de intervalo.

Licença [MIT](LICENSE).
