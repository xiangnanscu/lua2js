let setmetatable = setmetatable;
let ipairs = ipairs;
let tostring = tostring;
let type = type;
let pairs = pairs;
let assert = assert;
let error = error;
let string_format = string.format;
let table_concat = table.concat;
let table_insert = table.insert;
let table_new, clone, NULL;
if (ngx) {
  table_new = table.new;
  clone = require("table.clone");
  NULL = ngx.null;
} else {
  table_new = function (a, b) {
    return {};
  };
  clone = function (t) {
    let res = {};
    for (let [key, value] of Object.entries(t)) {
      res[key] = value;
    }
    return res;
  };
  NULL = setmetatable(
    {},
    {
      __newindex: function () {
        throw new Error("NULL object is read only");
      },
    }
  );
}
let make_raw_token = function make_raw_token(s) {
  let raw_token = function raw_token() {
    return s;
  };
  return raw_token;
};
let DEFAULT = make_raw_token("DEFAULT");
let sql__call = function sql__call(cls, kwargs) {
  if (typeof kwargs === "string") {
    return setmetatable({ table_name: kwargs }, cls);
  } else {
    return setmetatable(kwargs || {}, cls);
  }
};
let _class = function _class(t) {
  t.__index = t;
  t.new = function (cls, self) {
    return setmetatable(self || {}, cls);
  };
  t.__call = function (cls, ...varargs) {
    return cls.new(cls, ...varargs);
  };
  setmetatable(t, { __call: sql__call });
  return t;
};
let map = function map(tbl, func) {
  let res = {};
  for (let i = 0; i < tbl.length; i = i + 1) {
    res[i] = func(tbl[i]);
  }
  return res;
};
let flat = function flat(tbl) {
  let res = {};
  for (let i = 0; i < tbl.length; i = i + 1) {
    let t = tbl[i];
    if (typeof t !== "table") {
      res.push(t);
    } else {
      for (let j = 0; j < t.length; j = j + 1) {
        res.push(t[j]);
      }
    }
  }
  return res;
};
let _prefix_with_V = function _prefix_with_V(column) {
  return "V." + column;
};
let is_sql_instance = function is_sql_instance(row) {
  let meta = getmetatable(row);
  return meta && meta.__SQL_BUILDER__;
};
let _escape_factory = function _escape_factory(is_literal, is_bracket) {
  let as_sql_token = function as_sql_token(value) {
    let value_type = typeof value;
    if ("string" === value_type) {
      if (is_literal) {
        return "'" + (value.gsub("'", "''") + "'");
      } else {
        return value;
      }
    } else if ("number" === value_type) {
      return value;
    } else if ("boolean" === value_type) {
      return (value && "TRUE") || "FALSE";
    } else if ("function" === value_type) {
      let [val, err] = value();
      if (val === undefined) {
        throw new Error(err || "nil returned by value function");
      }
      return val;
    } else if ("table" === value_type) {
      if (is_sql_instance(value)) {
        return "(" + (value.statement() + ")");
      } else if (value[1] !== undefined) {
        let token = map(value, as_sql_token).join(", ");
        if (is_bracket) {
          return "(" + (token + ")");
        } else {
          return token;
        }
      } else {
        throw new Error("empty table as a Sql value is not allowed");
      }
    } else if (NULL === value) {
      return "NULL";
    } else {
      throw new Error(`don't know how to escape value: ${value} (${value_type})`);
    }
  };
  return as_sql_token;
};
let as_literal = _escape_factory(true, true);
let as_token = _escape_factory(false, false);
let sql__tostring = function sql__tostring(self) {
  return self.statement();
};
let assemble_sql = function assemble_sql(opts) {
  if (opts.update) {
    let from = (opts.from && " FROM " + opts.from) || "";
    let where = (opts.where && " WHERE " + opts.where) || "";
    let returning = (opts.returning && " RETURNING " + opts.returning) || "";
    return `UPDATE ${opts.table_name} SET ${opts.update}${from}${where}${returning}`;
  } else if (opts.insert) {
    let returning = (opts.returning && " RETURNING " + opts.returning) || "";
    return `INSERT INTO ${opts.table_name} ${opts.insert}${returning}`;
  } else if (opts.delete) {
    let using = (opts.using && " USING " + opts.using) || "";
    let where = (opts.where && " WHERE " + opts.where) || "";
    let returning = (opts.returning && " RETURNING " + opts.returning) || "";
    return `DELETE FROM ${opts.table_name} ${using}${where}${returning}`;
  } else {
    let from = opts.from || opts.table_name;
    let where = (opts.where && " WHERE " + opts.where) || "";
    let group = (opts.group && " GROUP BY " + opts.group) || "";
    let having = (opts.having && " HAVING " + opts.having) || "";
    let order = (opts.order && " ORDER BY " + opts.order) || "";
    let limit = (opts.limit && " LIMIT " + opts.limit) || "";
    let offset = (opts.offset && " OFFSET " + opts.offset) || "";
    return `SELECT ${(opts.distinct && "DISTINCT ") || ""}${
      opts.select || "*"
    } FROM ${from}${where}${group}${having}${order}${limit}${offset}`;
  }
};
let _get_insert_query_columns = function _get_insert_query_columns(columns, sub_query, internal_attr_name) {
  if (columns) {
    return as_token(columns);
  } else if (sub_query[internal_attr_name]) {
    return as_token(sub_query[internal_attr_name]);
  } else {
    return "";
  }
};
class Sql {
  static __tostring = sql__tostring;
  static __SQL_BUILDER__ = true;
  static r = make_raw_token;
  static DEFAULT = DEFAULT;
  static NULL = NULL;
  static as_token = as_token;
  static as_literal = as_literal;

  constructor(kwargs) {
    if (typeof kwargs === "string") {
      this.table_name = kwargs
    } else if (typeof kwargs === "object"){
      for (const key in kwargs) {
        if (Object.hasOwnProperty.call(kwargs, key)) {
          this[key] = kwargs[key];
        }
      }
    }
  }
  statement_for_with() {
    let statement = Sql.statement(this);
    if (this._with) {
      statement = `WITH ${this._with} ${statement}`;
    }
    return statement;
  }
  statement_for_set() {
    let statement = Sql.statement(this);
    if (this._intersect) {
      statement = `(${statement}) INTERSECT (${this._intersect})`;
    } else if (this._intersect_all) {
      statement = `(${statement}) INTERSECT ALL (${this._intersect_all})`;
    } else if (this._union) {
      statement = `(${statement}) UNION (${this._union})`;
    } else if (this._union_all) {
      statement = `(${statement}) UNION ALL (${this._union_all})`;
    } else if (this._except) {
      statement = `(${statement}) EXCEPT (${this._except})`;
    } else if (this._except_all) {
      statement = `(${statement}) EXCEPT ALL (${this._except_all})`;
    }
    return statement;
  }
  _get_keys(rows) {
    let columns = {};
    if (rows[1]) {
      let d = {};
      for (let [_, row] of rows.entries()) {
        for (let [k, _] of Object.entries(row)) {
          if (!d[k]) {
            d[k] = true;
            columns.push(k);
          }
        }
      }
    } else {
      for (let [k, _] of Object.entries(rows)) {
        columns.push(k);
      }
    }
    return columns;
  }
  _rows_to_array(rows, columns, fallback) {
    let c = columns.length;
    let n = rows.length;
    let res = table_new(n, 0);
    for (let i = 0; i < n; i = i + 1) {
      res[i] = table_new(c, 0);
    }
    for (let [i, col] of columns.entries()) {
      for (let j = 0; j < n; j = j + 1) {
        let v = rows[j][col];
        if (v !== undefined) {
          res[j][i] = v;
        } else {
          res[j][i] = fallback;
        }
      }
    }
    return res;
  }
  _get_insert_values_token(row, columns) {
    let value_list = {};
    if (!columns) {
      columns = {};
      for (let [k, v] of Object.entries(row)) {
        columns.push(k);
        value_list.push(v);
      }
    } else {
      for (let [i, col] of Object.entries(columns)) {
        let e = row[col];
        if (e !== undefined) {
          value_list.push(e);
        } else {
          value_list.push(DEFAULT);
        }
      }
    }
    return [as_literal(value_list), columns];
  }
  _get_bulk_insert_values_token(rows, columns, fallback) {
    columns = columns || this._get_keys(rows);
    rows = this._rows_to_array(rows, columns, fallback);
    return [map(rows, as_literal), columns];
  }
  _get_update_set_token(columns, key, table_name) {
    let tokens = {};
    if (typeof key === "string") {
      for (let [i, col] of columns.entries()) {
        if (col !== key) {
          tokens.push(`${col} = ${table_name}.${col}`);
        }
      }
    } else {
      let sets = {};
      for (let [i, k] of key.entries()) {
        sets[k] = true;
      }
      for (let [i, col] of columns.entries()) {
        if (!sets[col]) {
          tokens.push(`${col} = ${table_name}.${col}`);
        }
      }
    }
    return tokens.join(", ");
  }
  _get_select_token(a, b, ...varargs) {
    if (a === undefined) {
      throw new Error(b || "augument is required for _get_select_token");
    } else if (b === undefined) {
      return as_token(a);
    } else {
      let s = as_token(a) + (", " + as_token(b));
      for (let i = 0; i < varargs.length; i = i + 1) {
        s = s + (", " + as_token(varargs[i]));
      }
      return s;
    }
  }
  _get_select_token_literal(first, second, ...varargs) {
    if (first === undefined) {
      return undefined;
    } else if (second === undefined) {
      if (typeof first === "string") {
        return as_literal(first);
      } else if (typeof first === "table") {
        let tokens = {};
        for (let i = 0; i < first.length; i = i + 1) {
          tokens[i] = as_literal(first[i]);
        }
        return as_token(tokens);
      } else {
        return as_literal(first);
      }
    } else {
      let s = as_literal(first) + (", " + as_literal(second));
      for (let i = 0; i < varargs.length; i = i + 1) {
        let name = varargs[i];
        s = s + (", " + as_literal(name));
      }
      return s;
    }
  }
  _get_update_token(row, columns) {
    let kv = {};
    if (!columns) {
      for (let [k, v] of Object.entries(row)) {
        kv.push(`${k} = ${as_literal(v)}`);
      }
    } else {
      for (let [i, k] of columns.entries()) {
        let v = row[k];
        kv.push(`${k} = ${(v !== undefined && as_literal(v)) || "DEFAULT"}`);
      }
    }
    return kv.join(", ");
  }
  _get_with_token(name, token) {
    if (this.is_instance(token)) {
      return `${name} AS (${token.statement()})`;
    } else if (token !== undefined) {
      return `${name} AS ${token}`;
    } else {
      return as_token(name);
    }
  }
  _get_insert_token(row, columns) {
    [row, columns] = this._get_insert_values_token(row, columns);
    return `(${as_token(columns)}) VALUES ${row}`;
  }
  _get_bulk_insert_token(rows, columns) {
    [rows, columns] = this._get_bulk_insert_values_token(rows, columns, DEFAULT);
    return `(${as_token(columns)}) VALUES ${as_token(rows)}`;
  }
  _set_select_subquery_insert_token(sub_query, columns) {
    let columns_token = _get_insert_query_columns(columns, sub_query, "_select");
    if (columns_token !== "") {
      this._insert = `(${columns_token}) ${sub_query.statement()}`;
    } else {
      this._insert = sub_query.statement();
    }
  }
  _set_cud_subquery_insert_token(sub_query, columns) {
    let columns_token = _get_insert_query_columns(columns, sub_query, "_returning_args");
    let del_query = Sql.new({ table_name: "d" }).select(columns || sub_query._returning_args);
    this.with("d", sub_query);
    if (columns_token !== "") {
      this._insert = `(${columns_token}) ${del_query}`;
    } else {
      this._insert = del_query;
    }
  }
  _get_upsert_token(row, key, columns) {
    [row, columns] = this._get_insert_values_token(row, columns);
    let insert_token = `(${as_token(columns)}) VALUES ${row} ON CONFLICT (${this._get_select_token(key)})`;
    if ((typeof key === "table" && key.length === columns.length) || columns.length === 1) {
      return `${insert_token} DO NOTHING`;
    } else {
      return `${insert_token} DO UPDATE SET ${this._get_update_set_token(columns, key, "EXCLUDED")}`;
    }
  }
  _get_bulk_upsert_token(rows, key, columns) {
    [rows, columns] = this._get_bulk_insert_values_token(rows, columns, DEFAULT);
    let insert_token = `(${as_token(columns)}) VALUES ${as_token(rows)} ON CONFLICT (${this._get_select_token(key)})`;
    if ((typeof key === "table" && key.length === columns.length) || columns.length === 1) {
      return `${insert_token} DO NOTHING`;
    } else {
      return `${insert_token} DO UPDATE SET ${this._get_update_set_token(columns, key, "EXCLUDED")}`;
    }
  }
  _get_upsert_query_token(rows, key, columns) {
    if (!(typeof columns === "table")) {
      throw new Error("columns (table) must be provided for upserting from subquery");
    }
    let columns_token = this._get_select_token(columns);
    let insert_token = `(${columns_token}) ${rows.statement()} ON CONFLICT (${this._get_select_token(key)})`;
    if ((typeof key === "table" && key.length === columns.length) || columns.length === 1) {
      return `${insert_token} DO NOTHING`;
    } else {
      return `${insert_token} DO UPDATE SET ${this._get_update_set_token(columns, key, "EXCLUDED")}`;
    }
  }
  _get_join_expr(a, b, c) {
    if (a === undefined) {
      throw new Error(b || "augument is required for _get_join_expr");
    } else if (b === undefined) {
      return a;
    } else if (c === undefined) {
      return `${a} = ${b}`;
    } else {
      return `${a} ${b} ${c}`;
    }
  }
  _get_join_token(join_type, right_table, conditions, ...varargs) {
    if (conditions !== undefined) {
      return `${join_type} JOIN ${right_table} ON (${this._get_join_expr(conditions, ...varargs)})`;
    } else {
      return `${join_type} JOIN ${right_table}`;
    }
  }
  _get_inner_join(...varargs) {
    return this._get_join_token("INNER", ...varargs);
  }
  _get_left_join(...varargs) {
    return this._get_join_token("LEFT", ...varargs);
  }
  _get_right_join(...varargs) {
    return this._get_join_token("RIGHT", ...varargs);
  }
  _get_full_join(...varargs) {
    return this._get_join_token("FULL", ...varargs);
  }
  _get_in_token(cols, range, operator) {
    cols = as_token(cols);
    operator = operator || "IN";
    if (typeof range === "table") {
      if (this.is_instance(range)) {
        return `(${cols}) ${operator} (${range.statement()})`;
      } else {
        return `(${cols}) ${operator} ${as_literal(range)}`;
      }
    } else {
      return `(${cols}) ${operator} ${range}`;
    }
  }
  _get_update_query_token(sub_select, columns) {
    return `(${(columns && this._get_select_token(columns)) || sub_select._select}) = (${sub_select.statement()})`;
  }
  _get_join_conditions(key, left_table, right_table) {
    if (typeof key === "string") {
      return `${left_table}.${key} = ${right_table}.${key}`;
    }
    let res = {};
    for (let [_, k] of key.entries()) {
      res.push(`${left_table}.${k} = ${right_table}.${k}`);
    }
    return res.join(" AND ");
  }
  _get_cte_values_literal(rows, columns) {
    return this._get_bulk_insert_values_token(rows, columns, NULL);
  }
  _handle_where_token(where_token, tpl) {
    if (where_token === undefined || where_token === "") {
      return this;
    } else if (this._where === undefined) {
      this._where = where_token;
    } else {
      this._where = string_format(tpl, this._where, where_token);
    }
    return this;
  }
  _get_condition_token_from_table(kwargs, logic) {
    let tokens = {};
    for (let [k, value] of Object.entries(kwargs)) {
      if (typeof k === "string") {
        tokens.push(`${k} = ${as_literal(value)}`);
      } else {
        let token = this._get_condition_token(value);
        if (token !== undefined && token !== "") {
          tokens.push("(" + (token + ")"));
        }
      }
    }
    if (logic === undefined) {
      return tokens.join(" AND ");
    } else {
      return tokens.join(" " + (logic + " "));
    }
  }
  _get_condition_token(first, second, third) {
    if (first === undefined) {
      throw new Error(second || "no argument provided for _get_condition_token");
    } else if (second === undefined) {
      let argtype = typeof first;
      if (argtype === "table") {
        return this._get_condition_token_from_table(first);
      } else if (argtype === "string") {
        return first;
      } else if (argtype === "function") {
        let _where = this._where;
        this._where = undefined;
        let [res, err] = first.call(this);
        if (res !== undefined) {
          if (res === this) {
            let group_where = this._where;
            this._where = _where;
            return group_where;
          } else {
            return res;
          }
        } else {
          throw new Error(err || "nil returned in condition function");
        }
      } else {
        throw new Error("invalid condition type: " + argtype);
      }
    } else if (third === undefined) {
      return `${first} = ${as_literal(second)}`;
    } else {
      return `${first} ${second} ${as_literal(third)}`;
    }
  }
  _get_condition_token_or(first, ...varargs) {
    if (typeof first === "table") {
      return this._get_condition_token_from_table(first, "OR");
    } else {
      return this._get_condition_token(first, ...varargs);
    }
  }
  _get_condition_token_not(first, ...varargs) {
    let token;
    if (typeof first === "table") {
      token = this._get_condition_token_from_table(first, "OR");
    } else {
      token = this._get_condition_token(first, ...varargs);
    }
    return (token !== "" && `NOT (${token})`) || "";
  }
  statement() {
    let table_name = this.get_table();
    let statement = assemble_sql({
      table_name: table_name,
      join: this._join,
      distinct: this._distinct,
      returning: this._returning,
      insert: this._insert,
      update: this._update,
      delete: this._delete,
      using: this._using,
      select: this._select,
      from: this._from,
      where: this._where,
      group: this._group,
      having: this._having,
      order: this._order,
      limit: this._limit,
      offset: this._offset,
    });
    return statement;
  }
  with(...varargs) {
    let with_token = this._get_with_token(...varargs);
    if (this._with) {
      this._with = `${this._with}, ${with_token}`;
    } else {
      this._with = with_token;
    }
    if (this !== Sql) {
      this.statement = statement_for_with;
    }
    return this;
  }
  union(other_sql) {
    this._union = other_sql;
    if (this !== Sql) {
      this.statement = statement_for_set;
    }
    return this;
  }
  union_all(other_sql) {
    this._union_all = other_sql;
    if (this !== Sql) {
      this.statement = statement_for_set;
    }
    return this;
  }
  except(other_sql) {
    this._except = other_sql;
    if (this !== Sql) {
      this.statement = statement_for_set;
    }
    return this;
  }
  except_all(other_sql) {
    this._except_all = other_sql;
    if (this !== Sql) {
      this.statement = statement_for_set;
    }
    return this;
  }
  intersect(other_sql) {
    this._intersect = other_sql;
    if (this !== Sql) {
      this.statement = statement_for_set;
    }
    return this;
  }
  intersect_all(other_sql) {
    this._intersect_all = other_sql;
    if (this !== Sql) {
      this.statement = statement_for_set;
    }
    return this;
  }
  as(table_alias) {
    this._as = table_alias;
    return this;
  }
  with_values(name, rows) {
    let columns = this._get_keys(rows[1]);
    [rows, columns] = this._get_cte_values_literal(rows, columns);
    let cte_name = `${name}(${columns.join(", ")})`;
    let cte_values = `(VALUES ${as_token(rows)})`;
    return this.with(cte_name, cte_values);
  }
  insert(rows, columns) {
    if (typeof rows === "table") {
      if (this.is_instance(rows)) {
        if (rows._select) {
          this._set_select_subquery_insert_token(rows, columns);
        } else {
          this._set_cud_subquery_insert_token(rows, columns);
        }
      } else if (rows[1]) {
        this._insert = this._get_bulk_insert_token(rows, columns);
      } else if (next(rows) !== undefined) {
        this._insert = this._get_insert_token(rows, columns);
      } else {
        throw new Error("can't pass empty table to sql.insert");
      }
    } else if (rows !== undefined) {
      this._insert = rows;
    } else {
      throw new Error("can't pass nil to sql.insert");
    }
    return this;
  }
  update(row, columns) {
    if (typeof row === "table") {
      if (!this.is_instance(row)) {
        this._update = this._get_update_token(row, columns);
      } else {
        this._update = this._get_update_query_token(row, columns);
      }
    } else {
      this._update = row;
    }
    return this;
  }
  upsert(rows, key, columns) {
    if (!key) {
      throw new Error("you must provide key for upsert(string or table)");
    }
    if (this.is_instance(rows)) {
      this._insert = this._get_upsert_query_token(rows, key, columns);
    } else if (rows[1]) {
      this._insert = this._get_bulk_upsert_token(rows, key, columns);
    } else {
      this._insert = this._get_upsert_token(rows, key, columns);
    }
    return this;
  }
  is_instance(row) {
    return is_sql_instance(row);
  }
  merge(rows, key, columns) {
    if (rows.length === 0) {
      throw new Error("empty rows passed to merge");
    }
    [rows, columns] = this._get_cte_values_literal(rows, columns);
    let cte_name = `V(${columns.join(", ")})`;
    let cte_values = `(VALUES ${as_token(rows)})`;
    let join_cond = this._get_join_conditions(key, "V", "T");
    let vals_columns = map(columns, _prefix_with_V);
    let insert_subquery = Sql.new({ table_name: "V" })
      .select(vals_columns)
      .left_join("U AS T", join_cond)
      .where_null("T." + (key[1] || key));
    let updated_subquery;
    if ((typeof key === "table" && key.length === columns.length) || columns.length === 1) {
      updated_subquery = Sql.new({ table_name: "V" })
        .select(vals_columns)
        .join(this.table_name + " AS T", join_cond);
    } else {
      updated_subquery = Sql.new({ table_name: this.table_name, _as: "T" })
        .update(this._get_update_set_token(columns, key, "V"))
        .from("V")
        .where(join_cond)
        .returning(vals_columns);
    }
    this.with(cte_name, cte_values).with("U", updated_subquery);
    return Sql.insert.call(this, insert_subquery, columns);
  }
  updates(rows, key, columns) {
    if (this.is_instance(rows)) {
      columns = columns || flat(rows._returning_args);
      let cte_name = `V(${columns.join(", ")})`;
      let join_cond = this._get_join_conditions(key, "V", this._as || this.table_name);
      this.with(cte_name, rows);
      return Sql.update.call(this, this._get_update_set_token(columns, key, "V")).from("V").where(join_cond);
    } else if (rows.length === 0) {
      throw new Error("empty rows passed to updates");
    } else {
      [rows, columns] = this._get_cte_values_literal(rows, columns);
      let cte_name = `V(${columns.join(", ")})`;
      let cte_values = `(VALUES ${as_token(rows)})`;
      let join_cond = this._get_join_conditions(key, "V", this._as || this.table_name);
      this.with(cte_name, cte_values);
      return Sql.update.call(this, this._get_update_set_token(columns, key, "V")).from("V").where(join_cond);
    }
  }
  gets(keys) {
    if (keys.length === 0) {
      throw new Error("empty keys passed to gets");
    }
    let columns = this._get_keys(keys[1]);
    [keys, columns] = this._get_cte_values_literal(keys, columns);
    let join_cond = this._get_join_conditions(columns, "V", this._as || this.table_name);
    let cte_name = `V(${columns.join(", ")})`;
    let cte_values = `(VALUES ${as_token(keys)})`;
    return this.with(cte_name, cte_values).right_join("V", join_cond);
  }
  merge_gets(rows, keys) {
    let columns = this._get_keys(rows[1]);
    [rows, columns] = this._get_cte_values_literal(rows, columns);
    let join_cond = this._get_join_conditions(keys, "V", this._as || this.table_name);
    let cte_name = `V(${columns.join(", ")})`;
    let cte_values = `(VALUES ${as_token(rows)})`;
    return Sql.select.call(this, "V.*").with(cte_name, cte_values).right_join("V", join_cond);
  }
  copy() {
    let copy_sql = {};
    for (let [key, value] of Object.entries(this)) {
      if (typeof value === "table") {
        copy_sql[key] = clone(value);
      } else {
        copy_sql[key] = value;
      }
    }
    return setmetatable(copy_sql, getmetatable.call(this));
  }
  delete(...varargs) {
    this._delete = true;
    if (varargs[0] !== undefined) {
      this.where(...varargs);
    }
    return this;
  }
  distinct() {
    this._distinct = true;
    return this;
  }
  select(...varargs) {
    let s = this._get_select_token(...varargs);
    if (!this._select) {
      this._select = s;
    } else if (s !== undefined && s !== "") {
      this._select = this._select + (", " + s);
    }
    return this;
  }
  select_literal(...varargs) {
    let s = this._get_select_token_literal(...varargs);
    if (!this._select) {
      this._select = s;
    } else if (s !== undefined && s !== "") {
      this._select = this._select + (", " + s);
    }
    return this;
  }
  returning(...varargs) {
    let s = this._get_select_token(...varargs);
    if (!this._returning) {
      this._returning = s;
    } else if (s !== undefined && s !== "") {
      this._returning = this._returning + (", " + s);
    } else {
      return this;
    }
    this._returning_args = [...varargs];
    return this;
  }
  returning_literal(...varargs) {
    let s = this._get_select_token_literal(...varargs);
    if (!this._returning) {
      this._returning = s;
    } else if (s !== undefined && s !== "") {
      this._returning = this._returning + (", " + s);
    }
    return this;
  }
  group(...varargs) {
    if (!this._group) {
      this._group = this._get_select_token(...varargs);
    } else {
      this._group = this._group + (", " + this._get_select_token(...varargs));
    }
    return this;
  }
  group_by(...varargs) {
    return this.group(...varargs);
  }
  order(...varargs) {
    if (!this._order) {
      this._order = this._get_select_token(...varargs);
    } else {
      this._order = this._order + (", " + this._get_select_token(...varargs));
    }
    return this;
  }
  order_by(...varargs) {
    return this.order(...varargs);
  }
  _get_args_token(...varargs) {
    return this._get_select_token(...varargs);
  }
  using(...varargs) {
    this._delete = true;
    this._using = this._get_args_token(...varargs);
    return this;
  }
  from(...varargs) {
    if (!this._from) {
      this._from = this._get_args_token(...varargs);
    } else {
      this._from = this._from + (", " + this._get_args_token(...varargs));
    }
    return this;
  }
  get_table() {
    return (this._as === undefined && this.table_name) || this.table_name + (" AS " + this._as);
  }
  join(...varargs) {
    let join_token = this._get_inner_join(...varargs);
    this._from = `${this._from || this.get_table()} ${join_token}`;
    return this;
  }
  inner_join(...varargs) {
    return this.join(...varargs);
  }
  left_join(...varargs) {
    let join_token = this._get_left_join(...varargs);
    this._from = `${this._from || this.get_table()} ${join_token}`;
    return this;
  }
  right_join(...varargs) {
    let join_token = this._get_right_join(...varargs);
    this._from = `${this._from || this.get_table()} ${join_token}`;
    return this;
  }
  full_join(...varargs) {
    let join_token = this._get_full_join(...varargs);
    this._from = `${this._from || this.get_table()} ${join_token}`;
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  offset(n) {
    this._offset = n;
    return this;
  }
  where(first, ...varargs) {
    let where_token = this._get_condition_token(first, ...varargs);
    return this._handle_where_token(where_token, "(%s) AND (%s)");
  }
  where_or(first, ...varargs) {
    let where_token = this._get_condition_token_or(first, ...varargs);
    return this._handle_where_token(where_token, "(%s) AND (%s)");
  }
  or_where_or(first, ...varargs) {
    let where_token = this._get_condition_token_or(first, ...varargs);
    return this._handle_where_token(where_token, "%s OR %s");
  }
  where_not(first, ...varargs) {
    let where_token = this._get_condition_token_not(first, ...varargs);
    return this._handle_where_token(where_token, "(%s) AND (%s)");
  }
  or_where(first, ...varargs) {
    let where_token = this._get_condition_token(first, ...varargs);
    return this._handle_where_token(where_token, "%s OR %s");
  }
  or_where_not(first, ...varargs) {
    let where_token = this._get_condition_token_not(first, ...varargs);
    return this._handle_where_token(where_token, "%s OR %s");
  }
  where_exists(builder) {
    if (this._where) {
      this._where = `(${this._where}) AND EXISTS (${builder})`;
    } else {
      this._where = `EXISTS (${builder})`;
    }
    return this;
  }
  where_not_exists(builder) {
    if (this._where) {
      this._where = `(${this._where}) AND NOT EXISTS (${builder})`;
    } else {
      this._where = `NOT EXISTS (${builder})`;
    }
    return this;
  }
  where_in(cols, range) {
    let in_token = this._get_in_token(cols, range);
    if (this._where) {
      this._where = `(${this._where}) AND ${in_token}`;
    } else {
      this._where = in_token;
    }
    return this;
  }
  where_not_in(cols, range) {
    let not_in_token = this._get_in_token(cols, range, "NOT IN");
    if (this._where) {
      this._where = `(${this._where}) AND ${not_in_token}`;
    } else {
      this._where = not_in_token;
    }
    return this;
  }
  where_null(col) {
    if (this._where) {
      this._where = `(${this._where}) AND ${col} IS NULL`;
    } else {
      this._where = col + " IS NULL";
    }
    return this;
  }
  where_not_null(col) {
    if (this._where) {
      this._where = `(${this._where}) AND ${col} IS NOT NULL`;
    } else {
      this._where = col + " IS NOT NULL";
    }
    return this;
  }
  where_between(col, low, high) {
    if (this._where) {
      this._where = `(${this._where}) AND (${col} BETWEEN ${low} AND ${high})`;
    } else {
      this._where = `${col} BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  where_not_between(col, low, high) {
    if (this._where) {
      this._where = `(${this._where}) AND (${col} NOT BETWEEN ${low} AND ${high})`;
    } else {
      this._where = `${col} NOT BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  where_raw(where_token) {
    if (where_token === "") {
      return this;
    } else if (this._where) {
      this._where = `(${this._where}) AND (${where_token})`;
    } else {
      this._where = where_token;
    }
    return this;
  }
  or_where_exists(builder) {
    if (this._where) {
      this._where = `${this._where} OR EXISTS (${builder})`;
    } else {
      this._where = `EXISTS (${builder})`;
    }
    return this;
  }
  or_where_not_exists(builder) {
    if (this._where) {
      this._where = `${this._where} OR NOT EXISTS (${builder})`;
    } else {
      this._where = `NOT EXISTS (${builder})`;
    }
    return this;
  }
  or_where_in(cols, range) {
    let in_token = this._get_in_token(cols, range);
    if (this._where) {
      this._where = `${this._where} OR ${in_token}`;
    } else {
      this._where = in_token;
    }
    return this;
  }
  or_where_not_in(cols, range) {
    let not_in_token = this._get_in_token(cols, range, "NOT IN");
    if (this._where) {
      this._where = `${this._where} OR ${not_in_token}`;
    } else {
      this._where = not_in_token;
    }
    return this;
  }
  or_where_null(col) {
    if (this._where) {
      this._where = `${this._where} OR ${col} IS NULL`;
    } else {
      this._where = col + " IS NULL";
    }
    return this;
  }
  or_where_not_null(col) {
    if (this._where) {
      this._where = `${this._where} OR ${col} IS NOT NULL`;
    } else {
      this._where = col + " IS NOT NULL";
    }
    return this;
  }
  or_where_between(col, low, high) {
    if (this._where) {
      this._where = `${this._where} OR (${col} BETWEEN ${low} AND ${high})`;
    } else {
      this._where = `${col} BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  or_where_not_between(col, low, high) {
    if (this._where) {
      this._where = `${this._where} OR (${col} NOT BETWEEN ${low} AND ${high})`;
    } else {
      this._where = `${col} NOT BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  or_where_raw(where_token) {
    if (where_token === "") {
      return this;
    } else if (this._where) {
      this._where = `${this._where} OR ${where_token}`;
    } else {
      this._where = where_token;
    }
    return this;
  }
  having(...varargs) {
    if (this._having) {
      this._having = `(${this._having}) AND (${this._get_condition_token(...varargs)})`;
    } else {
      this._having = this._get_condition_token(...varargs);
    }
    return this;
  }
  having_not(...varargs) {
    if (this._having) {
      this._having = `(${this._having}) AND (${this._get_condition_token_not(...varargs)})`;
    } else {
      this._having = this._get_condition_token_not(...varargs);
    }
    return this;
  }
  having_exists(builder) {
    if (this._having) {
      this._having = `(${this._having}) AND EXISTS (${builder})`;
    } else {
      this._having = `EXISTS (${builder})`;
    }
    return this;
  }
  having_not_exists(builder) {
    if (this._having) {
      this._having = `(${this._having}) AND NOT EXISTS (${builder})`;
    } else {
      this._having = `NOT EXISTS (${builder})`;
    }
    return this;
  }
  having_in(cols, range) {
    let in_token = this._get_in_token(cols, range);
    if (this._having) {
      this._having = `(${this._having}) AND ${in_token}`;
    } else {
      this._having = in_token;
    }
    return this;
  }
  having_not_in(cols, range) {
    let not_in_token = this._get_in_token(cols, range, "NOT IN");
    if (this._having) {
      this._having = `(${this._having}) AND ${not_in_token}`;
    } else {
      this._having = not_in_token;
    }
    return this;
  }
  having_null(col) {
    if (this._having) {
      this._having = `(${this._having}) AND ${col} IS NULL`;
    } else {
      this._having = col + " IS NULL";
    }
    return this;
  }
  having_not_null(col) {
    if (this._having) {
      this._having = `(${this._having}) AND ${col} IS NOT NULL`;
    } else {
      this._having = col + " IS NOT NULL";
    }
    return this;
  }
  having_between(col, low, high) {
    if (this._having) {
      this._having = `(${this._having}) AND (${col} BETWEEN ${low} AND ${high})`;
    } else {
      this._having = `${col} BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  having_not_between(col, low, high) {
    if (this._having) {
      this._having = `(${this._having}) AND (${col} NOT BETWEEN ${low} AND ${high})`;
    } else {
      this._having = `${col} NOT BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  having_raw(token) {
    if (this._having) {
      this._having = `(${this._having}) AND (${token})`;
    } else {
      this._having = token;
    }
    return this;
  }
  or_having(...varargs) {
    if (this._having) {
      this._having = `${this._having} OR ${this._get_condition_token(...varargs)}`;
    } else {
      this._having = this._get_condition_token(...varargs);
    }
    return this;
  }
  or_having_not(...varargs) {
    if (this._having) {
      this._having = `${this._having} OR ${this._get_condition_token_not(...varargs)}`;
    } else {
      this._having = this._get_condition_token_not(...varargs);
    }
    return this;
  }
  or_having_exists(builder) {
    if (this._having) {
      this._having = `${this._having} OR EXISTS (${builder})`;
    } else {
      this._having = `EXISTS (${builder})`;
    }
    return this;
  }
  or_having_not_exists(builder) {
    if (this._having) {
      this._having = `${this._having} OR NOT EXISTS (${builder})`;
    } else {
      this._having = `NOT EXISTS (${builder})`;
    }
    return this;
  }
  or_having_in(cols, range) {
    let in_token = this._get_in_token(cols, range);
    if (this._having) {
      this._having = `${this._having} OR ${in_token}`;
    } else {
      this._having = in_token;
    }
    return this;
  }
  or_having_not_in(cols, range) {
    let not_in_token = this._get_in_token(cols, range, "NOT IN");
    if (this._having) {
      this._having = `${this._having} OR ${not_in_token}`;
    } else {
      this._having = not_in_token;
    }
    return this;
  }
  or_having_null(col) {
    if (this._having) {
      this._having = `${this._having} OR ${col} IS NULL`;
    } else {
      this._having = col + " IS NULL";
    }
    return this;
  }
  or_having_not_null(col) {
    if (this._having) {
      this._having = `${this._having} OR ${col} IS NOT NULL`;
    } else {
      this._having = col + " IS NOT NULL";
    }
    return this;
  }
  or_having_between(col, low, high) {
    if (this._having) {
      this._having = `${this._having} OR (${col} BETWEEN ${low} AND ${high})`;
    } else {
      this._having = `${col} BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  or_having_not_between(col, low, high) {
    if (this._having) {
      this._having = `${this._having} OR (${col} NOT BETWEEN ${low} AND ${high})`;
    } else {
      this._having = `${col} NOT BETWEEN ${low} AND ${high}`;
    }
    return this;
  }
  or_having_raw(token) {
    if (this._having) {
      this._having = `${this._having} OR ${token}`;
    } else {
      this._having = token;
    }
    return this;
  }
}
export default Sql;
