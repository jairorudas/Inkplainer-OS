# Melhorias necessárias — Inkplainer

Este documento organiza as melhorias recomendadas para tornar o Inkplainer mais seguro, sustentável, performático e confiável, preservando sua proposta de funcionar inteiramente no navegador.

## Prioridade 0 — Segurança e integridade dos dados

### 1. Remover inserção de dados do usuário via `innerHTML`

**Problema:** nomes de projetos, camadas, grupos ou presets podem ser interpolados em HTML. Isso permite injeção de marcação e possível XSS persistente através do IndexedDB.

**Ações:**

- Criar elementos com `document.createElement()`.
- Usar `textContent` para todo conteúdo fornecido pelo usuário.
- Manter `innerHTML` somente em templates totalmente estáticos.
- Revisar nomes de projetos, camadas, grupos, presets e mensagens importadas.
- Adicionar um teste com nomes como `<img src=x onerror=alert(1)>`.

**Concluído quando:** nenhum valor controlado pelo usuário é interpolado em `innerHTML` ou atributos HTML.

### 2. Tornar o salvamento no IndexedDB confiável

**Problema:** o indicador de sucesso pode aparecer antes da conclusão efetiva da transação. Falhas assíncronas, quota esgotada e abortos não são tratados de forma completa.

**Ações:**

- Tratar `request.onerror`, `transaction.onerror` e `transaction.onabort`.
- Mostrar o estado "salvo" somente em `transaction.oncomplete`.
- Informar claramente quando a quota de armazenamento estiver esgotada.
- Evitar iniciar salvamentos concorrentes do mesmo projeto.
- Manter alterações pendentes para uma nova tentativa quando um salvamento falhar.

**Concluído quando:** sucesso e falha refletem o resultado real da transação, inclusive com armazenamento indisponível ou cheio.

### 3. Validar arquivos e limites de entrada

**Ações:**

- Validar MIME type, extensão e tamanho dos uploads.
- Definir limites de dimensão e quantidade de camadas.
- Tratar imagens corrompidas e SVGs não processáveis.
- Exibir mensagens acionáveis em vez de falhas silenciosas.

## Prioridade 1 — Arquitetura e manutenção

### 4. Dividir o `index.html` em módulos

**Problema:** o arquivo principal concentra HTML, CSS, estado global, persistência, UI, Canvas, slicing, texto e exportação em mais de 11 mil linhas.

**Estrutura sugerida:**

```text
src/
  main.js
  app-state.js
  persistence.js
  layers.js
  canvas-renderer.js
  presets.js
  text-editor.js
  slicer.js
  animation-engine/
    index.js
    scanner.js
    contour.js
    outline.js
    specialized.js
  exporters/
    webm.js
    mp4.js
  ui/
    dialogs.js
    notifications.js
    controls.js
styles/
  tokens.css
  layout.css
  components.css
```

**Diretriz:** fazer a extração de forma incremental, sem reescrever o produto nem exigir a adoção de um framework.

**Concluído quando:** cada responsabilidade principal possui um módulo claro e o HTML contém principalmente marcação.

### 5. Eliminar implementações duplicadas

**Problema:** partes da orquestração de animações aparecem em `index.html` e `animations.js`, aumentando o risco de divergência.

**Ações:**

- Definir uma única fonte para `generate`, agrupamento, slots, playback e finalização.
- Expor uma API pequena e documentada para o motor de animação.
- Remover funções mortas ou substituídas.

### 6. Reduzir dependência de estado global e DOM

**Ações:**

- Encapsular o estado da aplicação.
- Passar configurações explicitamente para os algoritmos.
- Evitar que o motor leia sliders diretamente do DOM.
- Separar estado persistente, estado da interface e estado temporário de animação.

## Prioridade 1 — Testes e qualidade

### 7. Criar uma base de testes automatizados

> Estado atual: o projeto ainda não possui runner de testes. O efeito **Slide In** foi integrado em outubro de 2026 com verificação estática e roteiro manual; sua automação deve entrar nesta base quando ela for criada.

**Cobertura inicial:**

- Ordem sequencial e paralela das camadas.
- Serialização e restauração de projetos.
- Undo e redo.
- Criação, renomeação e exclusão de projetos.
- Slicing em grade, retângulo e desenho livre.
- Exportação e fallback de codecs.
- Cancelamento de exportação.
- Nomes contendo HTML e caracteres especiais.
- Slide In nas quatro direções e três transições, incluindo duração, pausa/reinício, grupos paralelos, persistência e paridade entre prévia/WebM/MP4.
- Projetos grandes e falhas de quota.

**Ferramentas sugeridas:**

- Vitest para unidades e funções puras.
- Playwright para fluxos reais no navegador.
- ESLint e Prettier para consistência.
- GitHub Actions para executar verificações a cada push e pull request.

**Concluído quando:** os fluxos essenciais podem ser validados automaticamente em Chrome e Firefox.

### 8. Adicionar scripts de desenvolvimento

Scripts esperados:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "format:check": "prettier --check ."
  }
}
```

O uso de Vite é opcional, mas facilita módulos, servidor local e validação de produção.

## Prioridade 2 — Performance

### 9. Mover processamento de imagem para Web Workers

**Problema:** detecção de bordas e loops sobre pixels bloqueiam a thread principal, especialmente em 1080p e 1440p.

**Ações:**

- Mover mapas de presença, bordas e agrupamentos para Workers.
- Avaliar `OffscreenCanvas` onde houver suporte.
- Transferir `ArrayBuffer` em vez de copiar grandes buffers.
- Permitir cancelamento de processamento.
- Exibir progresso real por etapa.

### 10. Criar cache dos resultados derivados

**Ações:**

- Guardar mapas de borda e waypoints por camada.
- Usar imagem, tamanho e configurações como chave de invalidação.
- Recalcular somente quando uma entrada relevante mudar.
- Reutilizar canvases e arrays tipados para reduzir garbage collection.

### 11. Otimizar a persistência de imagens

**Problema:** PNG em Data URL aumenta o volume armazenado e exige serializações caras.

**Ações:**

- Armazenar imagens como `Blob` no IndexedDB.
- Separar assets e metadados em object stores.
- Salvar somente camadas alteradas.
- Evitar `JSON.stringify()` de projetos inteiros apenas para estimar tamanho.
- Criar migração compatível com projetos existentes.

## Prioridade 2 — Operação offline e dependências

### 12. Incorporar dependências externas

**Ações:**

- Hospedar as fontes localmente.
- Incluir uma cópia versionada de `mp4-muxer` no projeto.
- Documentar a origem e licença de cada asset e dependência.
- Adicionar uma Content Security Policy compatível com o aplicativo.

**Concluído quando:** todas as funções, incluindo MP4, funcionam sem acesso à internet depois que o aplicativo estiver instalado ou servido localmente.

### 13. Completar o suporte PWA, se desejado

- Alterar o manifesto para comportamento de aplicativo quando apropriado.
- Adicionar service worker e cache versionado.
- Criar estratégia segura de atualização dos assets.
- Testar instalação e funcionamento offline.

## Prioridade 2 — Acessibilidade e experiência

### 14. Garantir operação por teclado

**Ações:**

- Substituir elementos clicáveis genéricos por `button` quando aplicável.
- Adicionar nomes acessíveis aos controles com ícones.
- Implementar foco visível e ordem de tabulação previsível.
- Conter e restaurar foco em modais.
- Permitir fechar diálogos com `Escape`.
- Garantir equivalentes de teclado e touch para drag, resize e slicing.

### 15. Revisar feedbacks de operações longas

- Diferenciar "processando", "renderizando" e "exportando".
- Mostrar etapa e progresso real quando possível.
- Permitir cancelamento seguro.
- Evitar indicar sucesso antes da conclusão.
- Fornecer erros com uma ação recomendada.

### 16. Realizar auditoria responsiva

- Testar 320 px, 768 px, notebooks e monitores grandes.
- Validar interações touch.
- Garantir que controles importantes não fiquem inacessíveis.
- Ajustar o editor para telas pequenas ou declarar claramente o tamanho mínimo suportado.

## Prioridade 3 — Exportação e compatibilidade

### 17. Fortalecer a exportação de vídeo

- Detectar suporte real a codec, perfil, resolução e bitrate.
- Testar Chrome, Edge, Firefox e Safari.
- Interromper e liberar streams, encoders e URLs temporárias em todos os caminhos.
- Tratar falta de memória e fechamento durante a exportação.
- Documentar diferenças de qualidade e compatibilidade entre MP4 e WebM.

### 18. Adicionar testes visuais dos algoritmos

- Manter imagens de entrada pequenas e determinísticas.
- Comparar frames finais com snapshots aprovados.
- Controlar ou injetar a fonte de aleatoriedade dos estilos que usam `Math.random()`.
- Validar que cada algoritmo termina e produz pixels dentro dos limites esperados.

## Sequência de implementação recomendada

1. Corrigir inserções inseguras em HTML.
2. Corrigir confirmação e falhas do IndexedDB.
3. Adicionar testes dos fluxos essenciais.
4. Eliminar código duplicado.
5. Extrair módulos do `index.html` de forma incremental.
6. Mover processamento pesado para Workers.
7. Migrar imagens persistidas para `Blob`.
8. Incorporar fontes e `mp4-muxer`.
9. Fazer auditoria de acessibilidade e compatibilidade.
10. Completar PWA e refinamentos de produto, se fizerem parte do objetivo.

## Critérios para uma versão estável

Uma versão pode ser considerada pronta para uso público estável quando:

- não houver injeção de HTML por dados do usuário;
- salvamentos e falhas de quota forem tratados corretamente;
- os fluxos essenciais possuírem testes automatizados;
- o processamento pesado não congelar a interface;
- projetos grandes puderem ser salvos sem serializações excessivas;
- a exportação tiver fallback e mensagens claras;
- os controles principais funcionarem com teclado;
- o aplicativo funcionar sem dependências remotas, caso a promessa offline seja mantida.
