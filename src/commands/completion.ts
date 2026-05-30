import { Command } from "commander";
import { type OutputOptions } from "../lib/output.js";

const COMMANDS = [
  "auth login", "auth status", "auth revoke", "auth refresh",
  "config get", "config set", "config path", "config init",
  "data list", "data get", "data create", "data patch", "data delete",
  "data batch-delete", "data reconcile", "data export-tcx",
  "data import", "data export", "data summarize",
  "rollup daily", "rollup physical",
  "profile get", "profile update",
  "settings get", "settings update",
  "identity",
  "irn",
  "devices list", "devices get",
  "subscribers list", "subscribers create", "subscribers patch", "subscribers delete",
  "subscribers subscriptions-list", "subscribers subscriptions-create",
  "subscribers subscriptions-patch", "subscribers subscriptions-delete",
  "types list", "types get",
  "endpoints",
  "doctor",
  "profiles list", "profiles current",
  "agent manifest", "agent capabilities", "agent schema",
  "api",
  "completion bash", "completion zsh", "completion fish",
];

const GLOBAL_FLAGS = [
  "--json", "--pretty", "--format", "--base-url", "--user", "--project", "--profile",
  "--help", "--version",
];

function bashScript(): string {
  return `# ghealth bash completion
# Add to ~/.bashrc or ~/.bash_profile:
#   source <(ghealth completion bash)

_ghealth_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local commands="${COMMANDS.map((c) => c.split(" ")[0]).filter((v, i, a) => a.indexOf(v) === i).join(" ")}"
  local global_flags="${GLOBAL_FLAGS.join(" ")}"

  case "\${prev}" in
    ghealth)
      COMPREPLY=( $(compgen -W "\${commands} \${global_flags}" -- "\${cur}") )
      return 0
      ;;
    auth)
      COMPREPLY=( $(compgen -W "login status revoke refresh" -- "\${cur}") )
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "get set path init" -- "\${cur}") )
      return 0
      ;;
    data)
      COMPREPLY=( $(compgen -W "list get create patch delete batch-delete reconcile export-tcx import export summarize" -- "\${cur}") )
      return 0
      ;;
    rollup)
      COMPREPLY=( $(compgen -W "daily physical" -- "\${cur}") )
      return 0
      ;;
    subscribers)
      COMPREPLY=( $(compgen -W "list create patch delete subscriptions-list subscriptions-create subscriptions-patch subscriptions-delete" -- "\${cur}") )
      return 0
      ;;
    devices)
      COMPREPLY=( $(compgen -W "list get" -- "\${cur}") )
      return 0
      ;;
    types)
      COMPREPLY=( $(compgen -W "list get" -- "\${cur}") )
      return 0
      ;;
    profiles)
      COMPREPLY=( $(compgen -W "list current" -- "\${cur}") )
      return 0
      ;;
    agent)
      COMPREPLY=( $(compgen -W "manifest capabilities schema" -- "\${cur}") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
    --format)
      COMPREPLY=( $(compgen -W "auto table json ndjson csv markdown" -- "\${cur}") )
      return 0
      ;;
    --last)
      COMPREPLY=( $(compgen -W "today yesterday 7d 30d 90d this-week last-week this-month last-month" -- "\${cur}") )
      return 0
      ;;
  esac

  COMPREPLY=( $(compgen -W "\${global_flags}" -- "\${cur}") )
  return 0
}

complete -F _ghealth_completions ghealth
`;
}

function zshScript(): string {
  return `#compdef ghealth
# ghealth zsh completion
# Add to your .zshrc:
#   source <(ghealth completion zsh)

_ghealth() {
  local -a commands
  commands=(
    'auth:Manage OAuth authentication'
    'config:Manage local configuration'
    'data:Read and write health data points'
    'rollup:Query health data rollups'
    'profile:Manage user profile'
    'settings:Manage user settings'
    'identity:Retrieve user identity'
    'irn:Irregular Rhythm Notification (AFib) profile'
    'devices:List and inspect paired trackers and smartwatches'
    'subscribers:Manage webhook subscribers and subscriptions'
    'types:Inspect supported data types'
    'endpoints:List REST API endpoints'
    'doctor:Verify local configuration'
    'profiles:Manage named profiles'
    'agent:Output structured metadata'
    'api:Make raw API requests'
    'completion:Generate shell completion scripts'
  )

  local -a auth_cmds=('login' 'status' 'revoke' 'refresh')
  local -a config_cmds=('get' 'set' 'path' 'init')
  local -a data_cmds=('list' 'get' 'create' 'patch' 'delete' 'batch-delete' 'reconcile' 'export-tcx' 'import' 'export' 'summarize')
  local -a rollup_cmds=('daily' 'physical')
  local -a agent_cmds=('manifest' 'capabilities' 'schema')
  local -a devices_cmds=('list' 'get')
  local -a subscriber_cmds=('list' 'create' 'patch' 'delete' 'subscriptions-list' 'subscriptions-create' 'subscriptions-patch' 'subscriptions-delete')
  local -a formats=('auto' 'table' 'json' 'ndjson' 'csv' 'markdown')
  local -a date_shorthands=('today' 'yesterday' '7d' '30d' '90d' 'this-week' 'last-week' 'this-month' 'last-month')

  _arguments -C \\
    '--json[Force JSON output]' \\
    '--pretty[Pretty-print JSON]' \\
    '--format[Output format]:format:($formats)' \\
    '--base-url[Override API base URL]:url:' \\
    '--user[Override user resource]:user:' \\
    '--project[Override project ID]:project:' \\
    '--profile[Use named profile]:profile:' \\
    '--retries[Retry count]:n:' \\
    '(-h --help)'{-h,--help}'[Show help]' \\
    '(-v --version)'{-v,--version}'[Show version]' \\
    '1: :->cmd' \\
    '*:: :->args'

  case \$state in
    cmd) _describe 'ghealth commands' commands ;;
    args)
      case \$words[1] in
        auth) _describe 'auth commands' auth_cmds ;;
        config) _describe 'config commands' config_cmds ;;
        data) _describe 'data commands' data_cmds ;;
        rollup) _describe 'rollup commands' rollup_cmds ;;
        devices) _describe 'devices commands' devices_cmds ;;
        subscribers) _describe 'subscribers commands' subscriber_cmds ;;
        agent) _describe 'agent commands' agent_cmds ;;
        completion) _describe 'shell' '(bash zsh fish)' ;;
      esac
    ;;
  esac
}

_ghealth "$@"
`;
}

function fishScript(): string {
  return `# ghealth fish completion
# Add to ~/.config/fish/completions/ghealth.fish or run:
#   ghealth completion fish > ~/.config/fish/completions/ghealth.fish

set -l subcommands auth config data rollup profile settings identity irn devices subscribers types endpoints doctor profiles agent api completion

# Disable file completions
complete -c ghealth -f

# Top-level subcommands
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a auth        -d 'Manage OAuth authentication'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a config      -d 'Manage local configuration'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a data        -d 'Read and write health data points'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a rollup      -d 'Query health data rollups'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a profile     -d 'Manage user profile'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a settings    -d 'Manage user settings'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a identity    -d 'Retrieve user identity'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a irn         -d 'Irregular Rhythm Notification (AFib) profile'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a devices     -d 'List and inspect paired trackers and smartwatches'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a subscribers -d 'Manage webhook subscribers and subscriptions'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a types       -d 'Inspect supported data types'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a endpoints   -d 'List REST API endpoints'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a doctor      -d 'Verify local configuration'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a profiles    -d 'Manage named profiles'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a agent       -d 'Output structured metadata'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a api         -d 'Make raw API requests'
complete -c ghealth -n '__fish_use_subcommand $subcommands' -a completion  -d 'Generate shell completion scripts'

# auth subcommands
complete -c ghealth -n '__fish_seen_subcommand_from auth' -a 'login status revoke refresh'

# config subcommands
complete -c ghealth -n '__fish_seen_subcommand_from config' -a 'get set path init'

# data subcommands
complete -c ghealth -n '__fish_seen_subcommand_from data' -a 'list get create patch delete batch-delete reconcile export-tcx import export summarize'

# rollup subcommands
complete -c ghealth -n '__fish_seen_subcommand_from rollup' -a 'daily physical'

# devices subcommands
complete -c ghealth -n '__fish_seen_subcommand_from devices' -a 'list get'

# subscribers subcommands
complete -c ghealth -n '__fish_seen_subcommand_from subscribers' -a 'list create patch delete subscriptions-list subscriptions-create subscriptions-patch subscriptions-delete'

# agent subcommands
complete -c ghealth -n '__fish_seen_subcommand_from agent' -a 'manifest capabilities schema'

# completion shells
complete -c ghealth -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'

# Global flags
complete -c ghealth -l json    -d 'Force JSON output'
complete -c ghealth -l pretty  -d 'Pretty-print JSON'
complete -c ghealth -l format  -d 'Output format' -a 'auto table json ndjson csv markdown'
complete -c ghealth -l profile -d 'Use named profile'

# --last shorthand completions
complete -c ghealth -n '__fish_seen_subcommand_from data rollup' -l last -a 'today yesterday 7d 30d 90d this-week last-week this-month last-month'
`;
}

export function makeCompletionCommand(_outOpts: () => OutputOptions): Command {
  const cmd = new Command("completion").description("Generate shell completion scripts");

  cmd
    .command("bash")
    .description("Generate bash completion script")
    .action(() => process.stdout.write(bashScript()));

  cmd
    .command("zsh")
    .description("Generate zsh completion script")
    .action(() => process.stdout.write(zshScript()));

  cmd
    .command("fish")
    .description("Generate fish completion script")
    .action(() => process.stdout.write(fishScript()));

  return cmd;
}
