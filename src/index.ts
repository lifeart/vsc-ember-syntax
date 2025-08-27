import * as vscode from 'vscode';

const typeScriptExtensionId = 'vscode.typescript-language-features';
const pluginId = 'typescript-hbs-plugin';
const configurationSection = 'hbs';

interface SynchronizedConfiguration {
  tags?: ReadonlyArray<string>;
  format: {
    enabled?: boolean;
  };
}

function updateLanguageSettings(languageId: string) {
  const config = vscode.workspace.getConfiguration('', {
    languageId,
  });
  config.update('editor.defaultFormatter', 'esbenp.prettier-vscode', vscode.ConfigurationTarget.Global, true);
  config.update('editor.foldingStrategy', 'indentation', vscode.ConfigurationTarget.Global, true);
}

updateLanguageSettings('glimmer-js');
updateLanguageSettings('glimmer-ts');

const { Global, Workspace } = vscode.ConfigurationTarget;
const eslintConfig = vscode.workspace.getConfiguration('eslint');
const eslintValidateInfo = eslintConfig.inspect('validate');
const globalValidate = eslintValidateInfo?.globalValue;
const workspaceValidate = eslintValidateInfo?.workspaceValue;
const glimmerScopes = ['glimmer-ts', 'glimmer-js'];

if (Array.isArray(globalValidate) && globalValidate.length) {
  const shouldRemoveValidateProperty = globalValidate.every((scope) => glimmerScopes.includes(scope));
  if (shouldRemoveValidateProperty) {
    eslintConfig.update('validate', undefined, Global);
  }
}

if (Array.isArray(workspaceValidate) && workspaceValidate.length) {
  const shouldRemoveValidateProperty = workspaceValidate.every((scope) => glimmerScopes.includes(scope));
  if (shouldRemoveValidateProperty) {
    eslintConfig.update('validate', undefined, Workspace);
  }
}

const prettierConfig = vscode.workspace.getConfiguration('prettier');
const documentSelectors = prettierConfig.get<Array<string>>('documentSelectors') ?? [];
const glimmerFileExtensions = ['**/*.gts', '**/*.gjs'];

prettierConfig.update(
  'documentSelectors',
  Array.from(new Set([...documentSelectors, ...glimmerFileExtensions])),
  vscode.ConfigurationTarget.Global,
);

export async function activate(context: vscode.ExtensionContext) {
  const extension = vscode.extensions.getExtension(typeScriptExtensionId);
  if (!extension) {
    return;
  }

  await extension.activate();
  if (!extension.exports || !extension.exports.getAPI) {
    return;
  }
  const api = extension.exports.getAPI(0);
  if (!api) {
    return;
  }

  vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration(configurationSection)) {
        synchronizeConfiguration(api);
      }
    },
    undefined,
    context.subscriptions,
  );

  synchronizeConfiguration(api);
}

function synchronizeConfiguration(api: any) {
  api.configurePlugin(pluginId, getConfiguration());
}

function getConfiguration(): SynchronizedConfiguration {
  const config = vscode.workspace.getConfiguration(configurationSection);
  const outConfig: SynchronizedConfiguration = {
    format: {
      enabled: true,
    },
    tags: ['hbs'],
  };

  withConfigValue<string[]>(config, 'tags', (tags) => {
    outConfig.tags = tags;
  });
  withConfigValue<boolean>(config, 'format.enabled', (enabled) => {
    outConfig.format.enabled = enabled;
  });
  console.log('outConfig', JSON.stringify(outConfig));
  return outConfig;
}

function withConfigValue<T>(config: vscode.WorkspaceConfiguration, key: string, withValue: (value: T) => void): void {
  const configSetting = config.inspect(key);
  if (!configSetting) {
    return;
  }

  // Make sure the user has actually set the value.
  // VS Code will return the default values instead of `undefined`, even if user has not don't set anything.
  if (
    typeof configSetting.globalValue === 'undefined' &&
    typeof configSetting.workspaceFolderValue === 'undefined' &&
    typeof configSetting.workspaceValue === 'undefined'
  ) {
    return;
  }

  const value = config.get<T | undefined>(key, undefined);
  if (typeof value !== 'undefined') {
    withValue(value);
  }
}
