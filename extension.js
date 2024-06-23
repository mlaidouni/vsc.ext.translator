// Import necessary modules
const vscode = require("vscode");
const axios = require("axios");
const languageTags = require("language-tags");
require("dotenv").config({ path: __dirname + "/.env" });

/**
 * This method is called when the extension is activated the very first time.
 * The extension is activated the very first time the command is executed
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Congratulations, extension "zemizer-translator" is now active!');

  // Save command 'hellowWorld'
  const disposable = vscode.commands.registerCommand(
    "zemizer-translator.helloWorld",
    async function () {
      // Show message to user
      vscode.window.showInformationMessage("Hello from ZeMizer Translator!");
    }
  );

  // Add the 'ZeTranslate' command (for translation)
  const translateDisposable = vscode.commands.registerCommand(
    "zemizer-translator.translate",
    cmdTranslate
  );

  // Add the command to the subscriptions list
  context.subscriptions.push(disposable, translateDisposable);
}

/* ****************************** Translator ****************************** */

/**
 * Function to get the names of the languages from their codes
 * @param {Array} codes - Array containing the codes of the languages
 * @returns {Object} languageNames - Object containing the names of the
 *     languages with their codes.
 */
async function getLanguageNames(codes) {
  const languageNames = {};

  codes.forEach((code) => {
    // Switch case to handle the special cases
    switch (code) {
      case "zh-CN":
        code = "cmn";
        break;
      case "zh-TW":
        code = "TW";
        break;
      case "mni-Mtei":
        code = "mni";
        break;
      default:
        code = code;
        break;
    }

    // Get the language from the code
    const language = languageTags.language(code);

    // Error handling
    if (!language) {
      console.error(`Language not found for code ${code}`);
      return;
    }

    // Get the name of the language
    const name = language.descriptions()[0];
    languageNames[code] = name;
  });

  return languageNames;
}

/**
 * Function to get the code of a language from its name
 * @param {Object} languages - Object containing the code and names of the languages
 * @param {String} name - Name of the language
 * @returns {String} code - Code of the language
 */
function nameToCode(languages, name) {
  for (const [code, langName] of Object.entries(languages)) {
    if (langName === name) return code;
  }
  return null;
}

/**
 * Function to configure the request of the API
 * @param {String} type - Type of the request
 * @param {String} url - URL of the request
 * @param {Object} data - Data to be sent in the request (default is empty)
 * @returns {Object} request - Request object
 */
function requestAPI(type, url, data = {}) {
  const request = {
    method: type,
    url: "https://deep-translate1.p.rapidapi.com/language/translate/v2" + url,
    headers: {
      "x-rapidapi-key": process.env.API_KEY,
      "x-rapidapi-host": "deep-translate1.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    data: data,
  };

  return request;
}

// Function to translate text
async function cmdTranslate() {
  // Retrieve the selected text in the active editor
  const editor = vscode.window.activeTextEditor;
  const selectedText = editor.selection;
  const text = editor.document.getText(selectedText);

  // Error handling
  if (!editor || !selectedText || !text) {
    vscode.window.showErrorMessage("ZeTranslate: No text selected!");
    return;
  }

  // Request the list of languages supported by the API
  const reqSupportedLanguages = requestAPI("GET", "/languages");

  let supportedLanguages;
  try {
    const response = await axios.request(reqSupportedLanguages);
    supportedLanguages = response.data.languages.map((lang) => lang.language);
  } catch (error) {
    console.error(error);
    vscode.window.showErrorMessage(
      "ZeTranslate: Error while getting the list of supported languages"
    );
    return;
  }

  // List of languages supported by the API
  const languages = await getLanguageNames(supportedLanguages);
  // List of names of the languages supported by the API
  const languagesNames = Object.values(languages);

  // Request the source language
  const sourceLangPick = await vscode.window.showQuickPick(languagesNames, {
    placeHolder: "Select the source language",
  });

  const sourceLang = sourceLangPick
    ? nameToCode(languages, sourceLangPick)
    : null;

  if (!sourceLang) {
    vscode.window.showInformationMessage(
      "ZeTranslate: Source language not specified"
    );
    return;
  }

  // Request the target language
  const targetLangPick = await vscode.window.showQuickPick(languagesNames, {
    placeHolder: "Select the target language",
  });

  const targetLang = targetLangPick
    ? nameToCode(languages, targetLangPick)
    : null;

  if (!targetLang) {
    vscode.window.showInformationMessage(
      "ZeTranslate: Target language not specified"
    );
    return;
  }

  // API request for the translation with the selected languages
  const options = requestAPI("POST", "", {
    q: text,
    source: sourceLang,
    target: targetLang,
  });

  try {
    // Execution of the request for the translation
    const response = await axios.request(options);
    // Add a new line if the original text ends with a new line
    const translatedText =
      response.data.data.translations.translatedText +
      (text.endsWith("\n") ? "\n" : "");

    // Replace the selected text with the translated text
    editor
      .edit((editBuilder) => {
        editBuilder.replace(editor.selection, translatedText);
      })
      .then((success) => {
        if (!success) {
          vscode.window.showErrorMessage(
            "ZeTranslate: Error while replacing the text"
          );
        }
      });
  } catch (error) {
    console.error(error);
    vscode.window.showErrorMessage(
      "ZeTranslate: Error while translating the text"
    );
  }
}

// This method is called when the extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
