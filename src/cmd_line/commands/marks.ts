import { window, QuickPickItem } from 'vscode';

import * as node from '../node';
import { VimState } from '../../state/vimState';
import { TextEditor } from '../../textEditor';
import { IMark } from '../../history/historyTracker';
import { Range } from '../../common/motion/range';

class MarkQuickPickItem implements QuickPickItem {
  mark: IMark;

  label: string;
  description: string;
  detail: string;
  picked = false;
  alwaysShow = false;

  constructor(mark: IMark) {
    this.mark = mark;
    this.label = mark.name;
    this.description = TextEditor.getLineAt(mark.position).text.trim();
    this.detail = `line ${mark.position.line} col ${mark.position.character}`;
  }
}

export class MarksCommand extends node.CommandBase {
  private marksFilter?: string[];

  constructor(marksFilter?: string[]) {
    super();
    this.marksFilter = marksFilter;
  }

  async execute(vimState: VimState): Promise<void> {
    const quickPickItems: MarkQuickPickItem[] = vimState.historyTracker
      .getMarks()
      .filter((mark) => {
        return !this.marksFilter || this.marksFilter.includes(mark.name);
      })
      .map((mark) => new MarkQuickPickItem(mark));

    if (quickPickItems.length > 0) {
      const item = await window.showQuickPick(quickPickItems, {
        canPickMany: false,
      });
      if (item) {
        vimState.cursors = [new Range(item.mark.position, item.mark.position)];
      }
    } else {
      window.showInformationMessage('No marks set');
    }
  }
}

export class DeleteMarksCommand extends node.CommandBase {
  private numbers = '0123456789';
  private numberRange = /([0-9])-([0-9])/;
  private letterRange = /([a-zA-Z])-([a-zA-Z])/;
  private args?: string;

  constructor(args?: string) {
    super();
    this.args = args;
  }

  range(start: number, end: number): number[] {
    let range: number[] = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  async execute(vimState: VimState): Promise<void> {
    if (!this.args) {
      window.showInformationMessage('Marks or range required.');
      return;
    }

    if (this.args === '!') {
      vimState.historyTracker.removeLocalMarks();
      return;
    }

    if (!this.args.includes('-')) {
      vimState.historyTracker.removeMarks(this.args.split(''));
      return;
    }

    const numberArgs: any = this.numberRange.exec(this.args);
    let letterArgs: any = this.letterRange.exec(this.args);

    if (!numberArgs && !letterArgs && this.args.includes('-')) {
      window.showInformationMessage(`Invalid range passed.`);
      return;
    }

    if (numberArgs && numberArgs.length > 2) {
      if (parseInt(numberArgs[1], 10) > parseInt(numberArgs[2], 10)) {
        window.showInformationMessage(`Invalid range ${numberArgs[1]} > ${numberArgs[2]}.`);
        return;
      }

      const start = this.numbers.indexOf(numberArgs[1]);
      const end = this.numbers.indexOf(numberArgs[2]);
      vimState.historyTracker.removeMarks(this.numbers.substring(start, end + 1).split(''));
    }

    while (letterArgs && letterArgs.length > 2) {
      if (this.caseMismatch(letterArgs[1], letterArgs[2])) {
        window.showInformationMessage(`Non matching case ${letterArgs[1]} - ${letterArgs[2]}.`);
        return;
      }

      const lowerCase = letterArgs[1] === letterArgs[1].toLowerCase();

      const letters = lowerCase ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const start = letters.indexOf(letterArgs[1]);
      const end = letters.indexOf(letterArgs[2]);

      if (start > end) {
        window.showInformationMessage(`Invalid range ${letterArgs[1]} - ${letterArgs[2]}.`);
        return;
      }

      vimState.historyTracker.removeMarks(letters.substring(start, end + 1).split(''));

      this.args = this.args.replace(letterArgs[0], '');
      letterArgs = this.letterRange.exec(this.args);
    }
  }

  caseMismatch(a: string, b: string): boolean {
    return (
      (a.toLowerCase() === a && b !== b.toLowerCase()) ||
      (b.toLowerCase() === b && a !== a.toLowerCase())
    );
  }
}
