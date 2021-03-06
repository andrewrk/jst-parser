/*
Copyright 2008, mark turansky (www.markturansky.com)
Copyright 2010, Andrew Kelley (superjoesoftware.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

The Software shall be used for Good, not Evil.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. 

(This is the license from www.json.org and I think it's awesome)
*/

var Jst = (function () {
    // private variables:
    
    // all write and writeln functions eval'd by Jst
    // concatenate to this internal variable
    var html = "";

    // private functions
    function CharacterStack(str) {
        var i;

        this.characters = [];
        this.peek = function peek() {
            return this.characters[this.characters.length - 1];
        };
        this.pop = function pop() {
            return this.characters.pop();
        };
        this.push = function push(c) {
            this.characters.push(c);
        };
        this.hasMore =  function hasMore() {
            return this.characters.length > 0;
        };

        for (i = str.length; i >= 0; i -= 1) {
            this.characters.push(str.charAt(i));
        }
    }

    function StringWriter() {
        this.str = "";
        this.write = function write(s) {
            this.str += s;
        };
        this.toString = function toString() {
            return this.str;
        };
    }

    function parseScriptlet(stack) {
        var fragment = new StringWriter();
        var c; // character

        while (stack.hasMore()) {
            if (stack.peek() === _public.delimiter) { //possible end delimiter
                c = stack.pop();
                if (stack.peek() === '>') { //end delimiter
                    // pop > so that it is not available to main parse loop
                    stack.pop();
                    if (stack.peek() === '\n') {
                        fragment.write(stack.pop());
                    }
                    break;
                } else {
                    fragment.write(c);
                }
            } else {
                fragment.write(stack.pop());
            }
        }
        return fragment.toString();
    }

    function startsWith(str, c) {
        return str.charAt(0) === c;
    }

    function endsWith(str, c) {
        return str.charAt(str.length - 1) === c;
    }

    function quoteRegExp(str) {
        return str.replace(/([.?*+\^$\[\]\\(){}\-])/g, "\\$1");
    }

    function replaceAll(str, a, b) {
        return str.replace(new RegExp(quoteRegExp(a), 'g'), b);
    }

    function appendExpressionFragment(writer, fragment, jstWriter) {
        var i,j;
        var c;

        // check to be sure quotes are on both ends of a string literal
        if (startsWith(fragment, "\"") && ! endsWith(fragment, "\"")) {
            //some scriptlets end with \n, especially if the script ends the file
            if (endsWith(fragment, "\n") && fragment.charAt(fragment.length - 2) === '"') {
                //we're ok...
            } else {
                throw { "message":"'" + fragment + "' is not properly quoted"};
            }
        }

        if (!startsWith(fragment, "\"") && endsWith(fragment, "\"")) {
            throw { "message":"'" + fragment + "' is not properly quoted"};
        }

        // print or println?
        if (endsWith(fragment, "\n")) {
            writer.write(jstWriter + "ln(");
            //strip the newline
            fragment = fragment.substring(0, fragment.length - 1);
        } else {
            writer.write(jstWriter + "(");
        }

        if (startsWith(fragment, "\"") && endsWith(fragment, "\"")) {
            //strip the quotes
            fragment = fragment.substring(1, fragment.length - 1);
            writer.write("\"");
            for (i = 0; i < fragment.length; i += 1) {
                c = fragment.charAt(i);
                if (c === '"') {
                    writer.write("\\");
                    writer.write(c);
                }
            }
            writer.write("\"");
        } else {
            for (j = 0; j < fragment.length; j += 1) {
                writer.write(fragment.charAt(j));
            }
        }

        writer.write(");");
    }

    function appendTextFragment(writer, fragment) {
        var i;
        var c;

        if (endsWith(fragment, "\n")) {
            writer.write("writeln(\"");
        } else {
            writer.write("write(\"");
        }

        for (i = 0; i < fragment.length; i += 1) {
            c = fragment.charAt(i);
            if (c === '"') {
                writer.write("\\");
            }
            // we took care of the line break with print vs. println
            if (c != '\n' && c != '\r') {
                writer.write(c);
            }
        }

        writer.write("\");");
    }

    function parseExpression(stack) {
        var fragment = new StringWriter();
        var c;

        while (stack.hasMore()) {
            if (stack.peek() === _public.delimiter) { //possible end delimiter
                c = stack.pop();
                if (stack.peek() === '>') { //end delimiter
                    //pop > so that it is not available to main parse loop
                    stack.pop();
                    if (stack.peek() === '\n') {
                        fragment.write(stack.pop());
                    }
                    break;
                } else {
                    fragment.write(_public.delimiter);
                }
            } else {
                fragment.write(stack.pop());
            }
        }

        return fragment.toString();
    }

    function parseText(stack) {
        var fragment = new StringWriter();
        var c,d;

        while (stack.hasMore()) {
            if (stack.peek() === '<') { //possible delimiter
                c = stack.pop();
                if (stack.peek() === _public.delimiter) { // delimiter!
                    // push c onto the stack to be used in main parse loop
                    stack.push(c);
                    break;
                } else {
                    fragment.write(c);
                }
            } else {
                d = stack.pop();
                fragment.write(d);
                if (d === '\n') { //done with this fragment.  println it.
                    break;
                }
            }
        }
        return fragment.toString();
    }

    function safeWrite(s) {
        s = s.toString();
        s = replaceAll(s, '&', '&amp;');
        s = replaceAll(s, '"', '&quot;');
        s = replaceAll(s, '<', '&lt;');
        s = replaceAll(s, '>', '&gt;');
        html += s;
    }

    function safeWriteln(s) {
        safeWrite(s + "\n");
    }

    function write(s) {
        html += s;
    }

    function writeln(s) {
        write(s + "\n");
    }

    // public methods:
    var _public = {};

    // change this if you want to use something other than percent sign
    _public.delimiter = '%';

    // pre-compile a template for quicker rendering. save the return value and 
    // pass it to evaluate.
    _public.compile = function (src) {
        var stack = new CharacterStack(src);
        var writer = new StringWriter();

        var c;
        var fragment;
        while (stack.hasMore()) {
            if (stack.peek() === '<') { //possible delimiter
                c = stack.pop();
                if (stack.peek() === _public.delimiter) {
                    c = stack.pop();
                    if (stack.peek() === "=") {
                        // expression, escape all html
                        stack.pop();
                        fragment = parseExpression(stack);
                        appendExpressionFragment(writer, fragment, "safeWrite");
                    } else if (stack.peek() === "+") {
                        // expression, don't escape html
                        stack.pop();
                        fragment = parseExpression(stack);
                        appendExpressionFragment(writer, fragment, "write");
                    } else {
                        fragment = parseScriptlet(stack);
                        writer.write(fragment);
                    }
                } else {  //not a delimiter
                    stack.push(c);
                    fragment = parseText(stack);
                    appendTextFragment(writer, fragment);
                }
            } else {
                fragment = parseText(stack);
                appendTextFragment(writer, fragment);
            }
        }
        return writer.toString();
    };

    // evaluate a pre-compiled script. recommended approach
    _public.evaluate = function (script, args) {
        with(args) {
            html = "";
            eval(script);
            return html;
        }
    };

    // if you're lazy, you can use this
    _public.evaluateSingleShot = function (src, args) {
        return _public.evaluate(_public.compile(src), args);
    };
    return _public;
})();
