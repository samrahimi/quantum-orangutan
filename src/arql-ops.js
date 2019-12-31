function equals(expr1, expr2) {
    return { op: 'equals', expr1, expr2 };
}
function or(...exprs) {
    if (exprs.length == 0) {
        throw new Error('0 arguments pass to or()');
    }
    if (exprs.length == 1) {
        return exprs[0];
    }
    const op = {
        op: 'or',
        expr1: exprs.shift(),
        expr2: exprs.length > 1 ? or(...exprs) : exprs[0]
    };
    return op;
}
function and(...exprs) {
    if (exprs.length == 0) {
        throw new Error('0 arguments pass to and()');
    }
    if (exprs.length == 1) {
        return exprs[0];
    }
    const op = {
        op: 'and',
        expr1: exprs.shift(),
        expr2: exprs.length > 1 ? and(...exprs) : exprs[0]
    };
    return op;
}

//i got stuck with browserify and "require" because i'm using 
//parts of the libp2p / ipfs stack that were never supposed to 
//run in a browser to begin with. 
module.exports= { and, equals, or };