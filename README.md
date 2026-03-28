# My Task Board

Aplicação de To Do List moderna para portfólio, com modo online/offline e visual responsivo.

## Stack
- Frontend: React + Vite
- Backend: Express + Prisma (PostgreSQL)

## Funcionalidades
- CRUD de tarefas com prioridade (baixa/média/alta)
- Concluir/desfazer, editar, excluir e limpar concluídas
- Filtros (todas, pendentes, concluídas) e contadores
- Persistência online (API) com fallback automático para `localStorage`
- Criação automática de board e seed inicial no backend
- Dark mode, responsividade e feedbacks visuais

## Executar rapidamente (modo API)
1. Backend  
   ```
   cd server
   npm install
   export DATABASE_URL="sua-string-postgres"
   npx prisma migrate dev
   npm run dev
   ```
2. Frontend  
   ```
   cd apps/web
   npm install
   export VITE_API_URL="http://localhost:4000/api"
   npm run dev
   ```

## Executar no modo offline (sem API)
1. Não suba o backend.
2. No frontend, rode:
   ```
   cd apps/web
   npm install
   VITE_API_URL= npm run dev
   ```
3. Abra `http://localhost:5173`. O chip “Offline / LocalStorage” indicará que tudo está salvo no navegador.  
Se já tiver usado o modo online antes, limpe `my-task-board.boardId` no localStorage para começar zerado.

## Modo offline (localStorage)
Se a API estiver indisponível, o frontend detecta a falha na sincronização e passa a salvar tudo em `localStorage`. Um chip “Offline / LocalStorage” aparece na toolbar. Quando a API voltar, basta recarregar para sincronizar novamente.

## Variáveis de ambiente
- `DATABASE_URL`: conexão Postgres (backend).
- `VITE_API_URL`: base da API no frontend (default `http://localhost:4000/api`).

## Estrutura
- `server/src/routes/board.routes.js`: criação e leitura de board, seed automático, fallback que devolve `x-board-id` quando recria.
- `server/src/routes/task.routes.js`: atualização, listagem e exclusão de tarefas com prioridade/status sincronizados.
- `apps/web/src/App.jsx`: interface completa, lógica online-first e fallback para `localStorage`.
- `apps/web/src/App.css` e `apps/web/src/index.css`: tema, layout e responsividade.

## Scripts úteis
- Backend: `npm run dev`, `npm run start`, `npx prisma migrate dev`, `npx prisma generate`
- Frontend: `npm run dev`, `npm run build`, `npm run lint`

## Decisões de UX
- Foco inicial no input, adicionar com Enter, mensagens de feedback temporizadas.
- Empty states diferentes para cada filtro.
- Preferência por API; se quebrar, o usuário continua sem perda de fluxo.

## Próximos passos sugeridos
- Adicionar testes de integração das rotas (supertest) e testes de UI.
- Implantar backend (Railway/Render) e apontar `VITE_API_URL` na build do frontend.
