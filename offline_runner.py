import ast
import contextlib
import io
import json
import sys

class LimitedOutput(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > 32768:
            raise RuntimeError('Слишком большой вывод программы (лимит 32 КБ)')
        return super().write(text)

def run(payload):
    output = LimitedOutput()
    result = {'tests': [], 'stdout': '', 'error': None}
    scope = {'__name__': '__main__'}
    try:
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            exec(compile(payload['code'], '<solution>', 'exec'), scope)
            tree = ast.parse(payload['tests'], filename='<tests>')
            for node in tree.body:
                label = 'Проверка ' + str(len(result['tests']) + 1)
                if isinstance(node, ast.Assert) and isinstance(node.msg, ast.Constant):
                    label = str(node.msg.value)
                try:
                    exec(compile(ast.Module(body=[node], type_ignores=[]), '<tests>', 'exec'), scope)
                    if isinstance(node, ast.Assert):
                        result['tests'].append({'label': label, 'passed': True})
                except BaseException as error:
                    result['tests'].append({'label': label, 'passed': False, 'error': type(error).__name__ + ': ' + str(error)})
    except BaseException as error:
        result['error'] = type(error).__name__ + ': ' + str(error)
    result['stdout'] = output.getvalue()
    return result

if __name__ == '__main__':
    payload = json.loads(sys.stdin.read())
    sys.stdout.write(json.dumps(run(payload), ensure_ascii=True))
