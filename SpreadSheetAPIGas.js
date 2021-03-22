/**
 * utilities
 */
const AppUtils = {

  parseGetParams(getE) {
    return getE.parameter;
  },
  parsePostData(postE) {
    return JSON.parse(postE.postData.getDataAsString());
  },
  convertPostDataToRow(postData, keys) {
    return keys.map(key=>{
      const value = postData[key];
      if (value instanceof Date) {
        return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    });
  },
  convertRowsToAPIResult(rows, keys) {
    const result = rows.map(row => {
      const obj = {};
      row.map((item, index) => {
        obj[String(keys[index])] = String(item);
      });
      return obj;
    });
    return result;
  },
}

/**
 * スプレッドシート管理
 */
function SpreadSheetDatabase(targetSheetName) {
  const _this = this;

  // 初期化
  const book = SpreadsheetApp.getActive();
  const sheet = book.getSheets().find(sheet => sheet.getName() === targetSheetName);
  if(!sheet){
    throw new Error('シートが存在しません');
  }

  // 1行目はカラムキー行
  _this.columnKeys = function () {
    return allRows().splice(0, 1)[0];
  };

  // 2行目以降はレコード行
  _this.allRecords = function () {
    const records = allRows();
    return records.slice(1, records.length);
  };

  // 全行取得
  function allRows() {
    return sheet.getDataRange().getValues();
  };

  // 行の挿入
  _this.insertRow = function(row) {
    if(!Array.isArray(row)){
      return;
    }
    return sheet.appendRow(row);
  };
}

/**
 * APIコントローラー
 */
function SpreadSheetAPIController() {
  const _this = this;
  let db;

  /**
   * 初期化
   * @param sheet:string
   */
  function initDB(e, method='GET') {
    let sheet = getTargetSheetNameFromData(
      parseDataWithMethodName(e, method)
    );
    // 指定スプレッドシートの管理インスタンスを生成
    db = makeTargetSpreadSheetDatabase(
      sheet
    );
  }

  /**
   * @method GET
   */
  _this.handleGet = function (e) {
    initDB(e, 'get');
    return AppUtils.convertRowsToAPIResult(
      db.allRecords(),
      db.columnKeys()
    );
  }
  /**
   * @method POST
   */
  _this.handlePost = function(e) {
    initDB(e, 'post');
    db.insertRow(
      AppUtils.convertPostDataToRow(
        AppUtils.parsePostData(e),
        db.columnKeys()
      )
    );
  }

  /** シート名が見つからないかった際の使用シート名 */
  const DEFAULT_SHEET_NAME = 'シート1';

  /**
   * 指定されたシート名を取得
   * @param data:object
   * @return sheet:string
   */
  function getTargetSheetNameFromData(data) {
    return (data && data.sheet) ? data.sheet : DEFAULT_SHEET_NAME;
  }
  /**
   * 指定されたmethod名に対応してdataを取得
   * @param e:request変数
   * @param method:string
   * @return data:object
   */
  function parseDataWithMethodName(e, method = 'GET') {
    if(method.toLowerCase() == 'get') {
      return AppUtils.parseGetParams(e);
    }
    if(method.toLowerCase() == 'post') {
      return AppUtils.parsePostData(e);
    }
  }

  /**
   * 指定したスプレッドシートの管理インスタンスを作成
   * @return db:SpreadSheetDatabase
   */
  function makeTargetSpreadSheetDatabase(sheet) {
    return new SpreadSheetDatabase(sheet);
  }
}

/**
 * @param data:object
 * @return output:TextOutput
 */
function Response(data) {
  return ContentService.createTextOutput(JSON.stringify(data, null, 2))
          .setMimeType(ContentService.MimeType.JSON);
}

/**
 * @param error:Error
 * @param etc:any
 * @return output:TextOutput
 */
function Abort(error, etc) {
  const errorResponse = {
    error: {
      message:error.message,
    }
  }
  errorResponse.etc = etc;
  return Response(errorResponse);
}

const contoller = new SpreadSheetAPIController();

function doGet(e) {
  try{
    let result = contoller.handleGet(e);
    return Response(result);
  } catch(error) {
    return Abort(error);
  }
}

function doPost(e) {
  contoller.handlePost(e);
}
