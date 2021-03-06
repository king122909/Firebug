function runTest() {
  var Fireformat = FW.Fireformat,
      pref;
  
  var prefMock = {
      getPref: function(name) {
        if (pref.hasOwnProperty(name)) {
          return pref[name];
        } else {
          FBTest.ok(false, "Attempted to lookup unexpected property: " + name);
        }
      }
  };
  function testWriter(defaultJoin, tokensPerLine, indent) {
    var writer = new Fireformat.Writer(prefMock);
    writer.writeTokens(tokens, defaultJoin, tokensPerLine, indent);
    return writer.toString();
  }

  tokens = [ "aaaa", "bbbb", "cccc", "dddd" ];

  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaafbbbbfcccc\needddd", testWriter("f", 0, 1), "One wrap");
  FBTest.compare("aaaaffffbbbb\neeccccffffdddd", testWriter("ffff", 0, 1), "Large padding");
  FBTest.compare("aaaafbbbb\neeeeccccfdddd", testWriter("f", 2, 2), "Tokens per line");


  pref = { wrapSize: 3, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaa\neebbbb\neecccc\needddd", testWriter("f", 0, 1), "All wrap");

  pref = { wrapSize: 80, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaafbbbbfccccfdddd", testWriter("f", 0, 1), "No wrap");

  pref = { wrapSize: 6, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaafbbbb\neecccc\needddd", testWriter("f", 0, 1), "Stacking");

  tokens = [];
  FBTest.compare("", testWriter("f", 0, 1), "Empty String");

  // Unique joins
  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bbbb", join: "hhhh" },
    "cccc",
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbbbb\neeccccxdddd", testWriter("x", 0, 1), "Unique join");

  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bbbb", join: "hhhh" },
    "cccc",
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 17, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbbbbhhhhcccc\needddd", testWriter("xxxx", 0, 1), "Unique join length");

  tokens = [
    { value: "aaaa", join: "" },
    { value: "bbbb", join: "hhhh" },
    "cccc",
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaabbbb\neeccccxdddd", testWriter("x", 0, 1), "Zero Length Join");

  // Nowrap tokens
  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bbbb", join: "hhhh" },
    { value: "cccc", nowrap: true },
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbbbbhhhhcccc\needddd", testWriter("x", 0, 1), "Token Wrap: Chars");

  pref = { wrapSize: 80, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbbbbhhhhcccc\needddd", testWriter("x", 2, 1), "Token Wrap: Tokens");

  // Test for join on wrapped tokens
  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bb\nbb", join: "hhhh" },
    { value: "cccc" },
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbb\neebbhhhhcccc\needddd", testWriter("x", 0, 1), "Join wrapped characters");

  // Preformatted tokens
  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bb\nbb", join: "hhhh", preformatted: true },
    { value: "cccc" },
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 9, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbb\nbbhhhhcccc\needddd", testWriter("x", 0, 1), "Preformatted tokens");

  // Newline join
  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bb\nbb", join: "\na\n", preformatted: true },
    { value: "cccc" },
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 9, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbb\nbb\neea\neeccccxdddd", testWriter("x", 0, 1), "Preformatted tokens");

  // Offset
  tokens = [
    { value: "aaaa", join: "g" },
    { value: "bb\nbb", join: "\na\n", preformatted: true, indentOffset: true },
    { value: "cccc", resetOffset: true },
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbb\nbb\neeeeeeea\neeeeeeecccc\needddd", testWriter("x", 0, 1), "Indent offset tokens");
  pref = { wrapSize: 11, indentChar: "\t", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaaagbb\nbb\n\t\t\t\t\ta\n\t\t\t\t\tcccc\n\t\tdddd", testWriter("x", 0, 1), "Indent offset tokens tab");

  tokens = [
    { value: "aaa\t", join: "g" },
    { value: "bb\nbb", join: "\na\n", preformatted: true, indentOffset: true },
    { value: "cccc", resetOffset: true },
    { value: "dddd", join: "i" }
  ];
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 1 };
  FBTest.compare("aaa\tgbb\nbb\neeeeeeea\neeeeeeecccc\needddd", testWriter("x", 0, 1), "Indent offset tokens with tabs");
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aaa\tgbb\nbb\neeeeeeeea\neeeeeeeecccc\needddd", testWriter("x", 0, 1), "Indent offset tokens with tabs");
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 3 };
  FBTest.compare("aaa\tgbb\nbb\neeeeeeeeea\neeeeeeeeecccc\needddd", testWriter("x", 0, 1), "Indent offset tokens with tabs");

  // Test wrapping with tabs
  tokens = [ "aa\t", "bbbb", "cccc", "dddd" ];

  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 2 };
  FBTest.compare("aa\tfbbbbfcccc\needddd", testWriter("f", 0, 1), "One wrab Tab 2");
  pref = { wrapSize: 11, indentChar: "e", indentCount: 2, tabSize: 4 };
  FBTest.compare("aa\tfbbbb\neeccccfdddd", testWriter("f", 0, 1), "One wrab Tab 4");
  
  // TODO : Test with mutliple indent levels
  FBTest.testDone();
}