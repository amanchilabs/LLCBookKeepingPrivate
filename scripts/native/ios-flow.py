"""Adapt existing Maestro fixtures to the iOS accessibility tree and scroll pane.

Index 0 matches the label, index 1 its input. Match the input above the pinned
footer before tapping; a visible label can precede a clipped input. Native Return
submits/blurs single-line fields. Bounded swipes stay inside Page.
"""
import sys
import json
from pathlib import Path

lines = Path(sys.argv[1]).read_text().splitlines()
result = []
footer = json.dumps(sys.argv[3] if len(sys.argv) > 3 else "Dashboard")
index = 0
while index < len(lines):
    line = lines[index]
    following = lines[index + 1] if index + 1 < len(lines) else ''
    if line == '- scrollUntilVisible:':
        block = []
        index += 1
        while index < len(lines) and lines[index].startswith(' '):
            block.append(lines[index].strip())
            index += 1
        target = next(item.removeprefix('element: ') for item in block if item.startswith('element: '))
        upward = 'direction: UP' in block
        is_input = index + 1 < len(lines) and lines[index + 1].startswith(('- inputText:', '- eraseText'))
        selector = ['text: ' + target, 'above:', '  text: ' + footer]
        if is_input:
            selector.append('index: 1')
        start, end = ('50%,35%', '50%,70%') if upward else ('50%,70%', '50%,35%')
        result.extend(['- evalScript: ${output.llcScrollAttempts = 0}', '- repeat:', '    while:', '      notVisible:'])
        result.extend('        ' + item for item in selector)
        result.extend([
            '      true: ${output.llcScrollAttempts < 12}',
            '    commands:', '      - swipe:', '          start: ' + start,
            '          end: ' + end, '          duration: 500',
            '      - evalScript: ${output.llcScrollAttempts += 1}', '- assertVisible:',
        ])
        result.extend('    ' + item for item in selector)
        continue
    if line.startswith('- tapOn: ') and following.startswith(('- inputText:', '- eraseText')):
        result.extend(['- tapOn:', '    text: ' + line.removeprefix('- tapOn: '), '    above:', '      text: ' + footer, '    index: 1', '- assertNotVisible: Return to books'])
        if not following.startswith('- eraseText'):
            result.append('- eraseText')
    elif line.startswith('- tapOn: '):
        target = line.removeprefix('- tapOn: ')
        try:
            plain_target = json.loads(target)
        except (ValueError, TypeError):
            plain_target = target
        if plain_target in {'Dashboard', 'Transactions', 'Members', 'Reports', 'More', 'dismiss popup', 'Open', 'Close', 'Continue'}:
            result.append(line)
        else:
            result.extend(['- tapOn:', '    text: ' + target, '    above:', '      text: ' + footer])
    elif line == '- hideKeyboard':
        result.append('- pressKey: ENTER')
    else:
        result.append(line)
    index += 1
Path(sys.argv[2]).write_text('\n'.join(result) + '\n')
