// ============================================================
// SISTEMA GESTOR ANA PAULA - Backend (Google Apps Script)
// Arquivo: Code.gs
// Versão: 1.0.0
// ============================================================

// ⚠️ CONFIGURAÇÃO: Substitua pelo ID da sua Planilha Google
const SPREADSHEET_ID = 'SEU_ID_DA_PLANILHA_AQUI';

// Nomes das abas
const ABA_CLIENTES = 'Clientes';
const ABA_RECIBOS  = 'Recibos';
const ABA_CONFIG   = 'Config';

// ============================================================
// PONTO DE ENTRADA DA API (POST)
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    let response;
    switch (action) {
      case 'get_data':          response = getData();                         break;
      case 'upsert_client':     response = upsertClient(payload.data);       break;
      case 'upsert_lancamento': response = upsertLancamento(payload.data);   break;
      case 'delete_client':     response = deleteClient(payload.id);         break;
      case 'delete_lancamento': response = deleteLancamento(payload.id);     break;
      case 'update_config':     response = updateConfig(payload.data);       break;
      default:
        response = { status: 'error', message: 'Ação desconhecida: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// ROTA: get_data — Retorna estado global em uma única chamada
// ============================================================
function getData() {
  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const clientes = getAbaData(ss, ABA_CLIENTES);
  const recibos  = getAbaData(ss, ABA_RECIBOS);
  const config   = getConfigData(ss);

  return {
    status: 'ok',
    clientes: clientes,
    recibos:  recibos,
    config:   config
  };
}

// ============================================================
// ROTA: upsert_client — Cria ou atualiza um cliente
// ============================================================
function upsertClient(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ABA_CLIENTES);
  const rows  = sheet.getDataRange().getValues();

  if (data.id) {
    // EDIÇÃO: Encontra e atualiza a linha existente
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.getRange(i + 1, 1, 1, 4).setValues([[
          data.id,
          data.nome_completo,
          data.cpf,
          data.data_nascimento
        ]]);
        return { status: 'ok', message: 'Cliente atualizado com sucesso.' };
      }
    }
    return { status: 'error', message: 'Cliente não encontrado para edição.' };
  } else {
    // CRIAÇÃO: Calcula novo ID e insere
    const ids  = rows.slice(1).map(r => parseInt(r[0]) || 0);
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    sheet.appendRow([newId, data.nome_completo, data.cpf, data.data_nascimento]);
    return { status: 'ok', message: 'Cliente cadastrado com sucesso.', id: newId };
  }
}

// ============================================================
// ROTA: upsert_lancamento — Cria ou atualiza um recibo
// SEGURANÇA: Validação da Trava de Competência no servidor
// ============================================================
function upsertLancamento(data) {
  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = getConfigData(ss);

  // ⚠️ TRAVA DE COMPETÊNCIA (Camada de Servidor)
  const dataTrava       = new Date(config.data_trava + 'T00:00:00');
  const dataAtendimento = new Date(data.data_atendimento + 'T00:00:00');

  if (dataAtendimento <= dataTrava) {
    return {
      status: 'error',
      message: 'Competência bloqueada administrativamente para alterações.'
    };
  }

  const sheet = ss.getSheetByName(ABA_RECIBOS);
  const rows  = sheet.getDataRange().getValues();
  const agora = new Date().toISOString();

  if (data.id) {
    // EDIÇÃO
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.getRange(i + 1, 1, 1, 7).setValues([[
          data.id,
          data.data_atendimento,
          data.cliente_id,
          data.nome_cliente,
          parseFloat(data.valor),
          data.tipo_consulta,
          rows[i][6] // Mantém DATA_CRIACAO original
        ]]);
        return { status: 'ok', message: 'Recibo atualizado com sucesso.' };
      }
    }
    return { status: 'error', message: 'Recibo não encontrado para edição.' };
  } else {
    // CRIAÇÃO
    const ids   = rows.slice(1).map(r => parseInt(r[0]) || 0);
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    sheet.appendRow([
      newId,
      data.data_atendimento,
      data.cliente_id,
      data.nome_cliente,
      parseFloat(data.valor),
      data.tipo_consulta,
      agora
    ]);
    return { status: 'ok', message: 'Recibo lançado com sucesso.', id: newId };
  }
}

// ============================================================
// ROTA: delete_client — Remove um cliente
// ============================================================
function deleteClient(id) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ABA_CLIENTES);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { status: 'ok', message: 'Cliente removido com sucesso.' };
    }
  }
  return { status: 'error', message: 'Cliente não encontrado.' };
}

// ============================================================
// ROTA: delete_lancamento — Remove um recibo
// ============================================================
function deleteLancamento(id) {
  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = getConfigData(ss);
  const sheet  = ss.getSheetByName(ABA_RECIBOS);
  const rows   = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      const dataAtendimento = new Date(rows[i][1] + 'T00:00:00');
      const dataTrava       = new Date(config.data_trava + 'T00:00:00');

      if (dataAtendimento <= dataTrava) {
        return {
          status: 'error',
          message: 'Competência bloqueada administrativamente para alterações.'
        };
      }
      sheet.deleteRow(i + 1);
      return { status: 'ok', message: 'Recibo excluído com sucesso.' };
    }
  }
  return { status: 'error', message: 'Recibo não encontrado.' };
}

// ============================================================
// ROTA: update_config — Atualiza parâmetros administrativos
// ============================================================
function updateConfig(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ABA_CONFIG);
  const rows  = sheet.getDataRange().getValues();

  const map = {
    data_trava:            data.data_trava,
    codigo_rendimento:     data.codigo_rendimento,
    codigo_ocupacao:       data.codigo_ocupacao,
    cpf_profissional:      data.cpf_profissional,
    registro_profissional: data.registro_profissional,
    nome_profissional:     data.nome_profissional
  };

  for (let i = 0; i < rows.length; i++) {
    const chave = rows[i][0];
    if (map[chave] !== undefined) {
      sheet.getRange(i + 1, 2).setValue(map[chave]);
    }
  }
  return { status: 'ok', message: 'Configurações atualizadas com sucesso.' };
}

// ============================================================
// HELPERS INTERNOS
// ============================================================
function getAbaData(ss, abaName) {
  const sheet  = ss.getSheetByName(abaName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getConfigData(ss) {
  const sheet  = ss.getSheetByName(ABA_CONFIG);
  const values = sheet.getDataRange().getValues();
  const config = {};
  values.forEach(row => { config[row[0]] = row[1]; });
  return config;
}

// ============================================================
// FUNÇÃO DE SETUP: Executa UMA VEZ para criar a estrutura
// ============================================================
function setupPlanilha() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Aba: Clientes
  let abaClientes = ss.getSheetByName(ABA_CLIENTES);
  if (!abaClientes) abaClientes = ss.insertSheet(ABA_CLIENTES);
  abaClientes.getRange(1, 1, 1, 4).setValues([['ID', 'NOME_COMPLETO', 'CPF', 'DATA_NASCIMENTO']]);
  abaClientes.getRange(1, 1, 1, 4).setFontWeight('bold');

  // Aba: Recibos
  let abaRecibos = ss.getSheetByName(ABA_RECIBOS);
  if (!abaRecibos) abaRecibos = ss.insertSheet(ABA_RECIBOS);
  abaRecibos.getRange(1, 1, 1, 7).setValues([['ID', 'DATA_ATENDIMENTO', 'CLIENTE_ID', 'NOME_CLIENTE', 'VALOR', 'TIPO_CONSULTA', 'DATA_CRIACAO']]);
  abaRecibos.getRange(1, 1, 1, 7).setFontWeight('bold');

  // Aba: Config
  let abaConfig = ss.getSheetByName(ABA_CONFIG);
  if (!abaConfig) abaConfig = ss.insertSheet(ABA_CONFIG);
  const configDefaults = [
    ['data_trava',            '2000-01-01'],
    ['codigo_rendimento',     'R01.001.001'],
    ['codigo_ocupacao',       '255'],
    ['cpf_profissional',      ''],
    ['registro_profissional', ''],
    ['nome_profissional',     'Ana Paula']
  ];
  abaConfig.getRange(1, 1, configDefaults.length, 2).setValues(configDefaults);

  SpreadsheetApp.flush();
  Logger.log('Setup concluído com sucesso!');
}
