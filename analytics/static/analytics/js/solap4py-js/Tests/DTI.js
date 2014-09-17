module("DTI");

QUnit.config.reorder = false;

var query = new QueryAPI();


function testDTI11(){
  var result = query.explore(["Traffic"]);
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], {"[Traffic]":{"caption":"Traffic"}});
}

function testDTI12(){
  var result = query.explore(["Traffic", "[Traffic]", "[Zone]", "[Zone.Name]", "[Zone.Name].[Name0]"], false);
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], {"[Zone.Name].[All Zone.Names].[Croatia]":{"caption":"Croatia"},"[Zone.Name].[All Zone.Names].[Switzerland]":{"caption":"Switzerland"},"[Zone.Name].[All Zone.Names].[Cyprus]":{"caption":"Cyprus"},"[Zone.Name].[All Zone.Names].[Portugal]":{"caption":"Portugal"},"[Zone.Name].[All Zone.Names].[France]":{"caption":"France"},"[Zone.Name].[All Zone.Names].[Italy]":{"caption":"Italy"},"[Zone.Name].[All Zone.Names].[United Kingdom]":{"caption":"United Kingdom"},"[Zone.Name].[All Zone.Names].[Finland]":{"caption":"Finland"},"[Zone.Name].[All Zone.Names].[Iceland]":{"caption":"Iceland"},"[Zone.Name].[All Zone.Names].[Slovakia]":{"caption":"Slovakia"},"[Zone.Name].[All Zone.Names].[Belgium]":{"caption":"Belgium"},"[Zone.Name].[All Zone.Names].[Luxembourg]":{"caption":"Luxembourg"},"[Zone.Name].[All Zone.Names].[Turkey]":{"caption":"Turkey"},"[Zone.Name].[All Zone.Names].[Norway]":{"caption":"Norway"},"[Zone.Name].[All Zone.Names].[Slovenia]":{"caption":"Slovenia"},"[Zone.Name].[All Zone.Names].[Austria]":{"caption":"Austria"},"[Zone.Name].[All Zone.Names].[Romania]":{"caption":"Romania"},"[Zone.Name].[All Zone.Names].[Czech Republic]":{"caption":"Czech Republic"},"[Zone.Name].[All Zone.Names].[Malta]":{"caption":"Malta"},"[Zone.Name].[All Zone.Names].[Lithuania]":{"caption":"Lithuania"},"[Zone.Name].[All Zone.Names].[Denmark]":{"caption":"Denmark"},"[Zone.Name].[All Zone.Names].[Estonia]":{"caption":"Estonia"},"[Zone.Name].[All Zone.Names].[The former Yugoslav Republic of Macedonia]":{"caption":"The former Yugoslav Republic of Macedonia"},"[Zone.Name].[All Zone.Names].[Hungary]":{"caption":"Hungary"},"[Zone.Name].[All Zone.Names].[Latvia]":{"caption":"Latvia"},"[Zone.Name].[All Zone.Names].[Germany]":{"caption":"Germany"},"[Zone.Name].[All Zone.Names].[Bulgaria]":{"caption":"Bulgaria"},"[Zone.Name].[All Zone.Names].[Sweden]":{"caption":"Sweden"},"[Zone.Name].[All Zone.Names].[Greece]":{"caption":"Greece"},"[Zone.Name].[All Zone.Names].[Netherlands]":{"caption":"Netherlands"},"[Zone.Name].[All Zone.Names].[Liechtenstein]":{"caption":"Liechtenstein"},"[Zone.Name].[All Zone.Names].[Ireland]":{"caption":"Ireland"},"[Zone.Name].[All Zone.Names].[Poland]":{"caption":"Poland"},"[Zone.Name].[All Zone.Names].[Spain]":{"caption":"Spain"}});
}


function testDTI13(){
  var result = query.explore(["wrong schema"]);
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "BAD_REQUEST", "bad request");
  equal(result["data"], "Invalid schema identifier");
}

function testDTI14(){
  query.clear();
  query.drill("[Traffic]");
  query.push("[Measures].[Max Quantity]");
  query.slice("[Time]", ["[Time].[2000]","[Time].[2003]"], true);

var expected = {
  "error": "OK",
  "data": [
    {
      "[Measures].[Max Quantity]": 311121,
      "[Time]": "[Time].[All Times].[2000]"
    },
    {
      "[Measures].[Max Quantity]": 304574,
      "[Time]": "[Time].[All Times].[2001]"
    },
    {
      "[Measures].[Max Quantity]": 310543,
      "[Time]": "[Time].[All Times].[2002]"
    },
    {
      "[Measures].[Max Quantity]": 315811,
      "[Time]": "[Time].[All Times].[2003]"
    }
  ]
} ;
  var result = query.execute();
  deepEqual(result, expected, ' ');
}


function testDTI15(){
  query.clear();
  query.drill("[Traffic]");
  query.push("[Measures].[Goods Quantity]");
  query.slice("[Time]", ["[Time].[1950]"], false);

  var expected = {"error":"OK","data":[{"[Measures].[Goods Quantity]":0,"[Time]":"[Time].[All Times].[1950]"}]};
  var result = query.execute();
  deepEqual(result, expected, ' ');
}

function runTest(f){
  test(f.toString(), f);
}

function runTests(){
  test(testDTI11.toString(), testDTI11);
  test(testDTI12.toString(), testDTI12);
  test(testDTI13.toString(), testDTI13);
  test(testDTI14.toString(), testDTI14);
  test(testDTI15.toString(), testDTI15);
}

runTests();

query.clear();

