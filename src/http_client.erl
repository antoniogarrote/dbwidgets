-module(http_client).
-author('antoniogarrote@gmail.com').

-export([retrieve/1, regexp_split_inclusive/2, acceptGzip/1]).

%% RegExps

regexp_loop(Str, Parts, Index, []) ->
    lists:reverse([string:substr(Str, Index)] ++ Parts);
regexp_loop(Str, Parts, Index, Rem_Matches) ->
    {NextPt,PtLen} = hd(Rem_Matches),
    regexp_loop( Str, [ string:substr(Str, NextPt, PtLen),
                        string:substr(Str, Index, NextPt - Index)] ++ Parts, NextPt + PtLen,
                 tl(Rem_Matches) ).
 
regexp_split_inclusive(Str, Regex) ->
    {match, Matches} = regexp:matches(Str, Regex),
    regexp_loop(Str, [], 1, Matches).

%% Parsing requests

parseRequest(Req) ->
    Header = case Req:get_header_value("accept") of
                 undefined -> case Req:get_header_value("Accept") of
                                  undefined -> "text/n3" ;
                                  OtherValue -> OtherValue
                              end;
                 OneValue -> OneValue
             end,
    QS = Req:parse_qs(),
    case lists:keysearch("uri",1,QS) of
        false        -> {error, []};
        {value, {_,Uri}}  -> {ok, {Uri, Header}}
    end.
            
validHeaders(Headers) ->
    validHeaders(Headers,[], ["content-length", "content-location", "content-type"]) .

validHeaders(_Headers, Acum, []) ->
    Acum;
validHeaders(Headers, Acum, [V|Vs]) ->
    case lists:keysearch(V,1,Headers) of
        false        -> validHeaders(Headers, Acum, Vs) ;
        {value, {_,Val}}  -> validHeaders(Headers, [{V,Val}|Acum], Vs)
    end.

acceptGzip(Headers) ->    
    case lists:keysearch(Headers, 1, "accept-encoding") of
        false ->
            false;
        {value, {_,Val}} ->
            Parts = regexp_split_inclusive(Val,","),
            acceptGzip(headers, Parts)
    end .

acceptGzip(headers,[]) ->
    false;
acceptGzip(headers,["gzip"|T]) ->
    true;
acceptGzip(headers,[_|T]) ->
    acceptGzip(headers,T).


%% Link Header

processLinkResponse(Req, AcceptHeaders, LinkHeader, Counter) ->
    AcceptParts = regexp_split_inclusive(AcceptHeaders, ",\s*"),
    LinkParts = regexp_split_inclusive(LinkHeader, ";\s*|,\s*"),
    %error_logger:warning_msg("\n\n\n\n\n AFTER REGEXP  ACCEPTS:~p ~n LINKS:~p ~n",[AcceptParts, LinkParts]),                                            
    doProcessLinkResponse(Req, AcceptParts, LinkParts, undefined, undefined, Counter).

doProcessLinkResponse(Req, _, undefined,_, _, _Counter) ->
    %error_logger:warning_msg("\n\n 1",[]),
    Req:respond(400, [], "");
doProcessLinkResponse(Req, _, [], undefined, _, _Counter) ->
    doProcessLinkResponse(Req, undefined, undefined, undefined, undefined, undefined);
doProcessLinkResponse(Req, _, [], _, undefined, _Counter) ->
    doProcessLinkResponse(Req, undefined, undefined, undefined, undefined, undefined);

doProcessLinkResponse(Req, Acs, ["<"++Uri | T], undefined, Type, Counter) ->
    ">" ++ Uri2 =  lists:reverse(Uri),
    case Type of
        undefined -> doProcessLinkResponse(Req, Acs, T, lists:reverse(Uri2), undefined, Counter);
        _ -> case doCheckAcceptType(Acs, Type) of
                 false -> %error_logger:warning_msg("RECURRING: ~p",[T]),
                          doProcessLinkResponse(Req, Acs, T, undefined, undefined, Counter) ;
                 true  -> doRetrieve(Req, lists:reverse(Uri2),Type, Counter+1)
             end
    end;
doProcessLinkResponse(Req, Acs, ["type=\""++TypeP | T], Uri, undefined, Counter) ->
    "\""++Type = lists:reverse(TypeP),
    case Uri of
        undefined -> doProcessLinkResponse(Req, Acs, T, undefined, lists:reverse(Type), Counter);
        _ -> case doCheckAcceptType(Acs, lists:reverse(Type)) of
                 false -> %error_logger:warning_msg("RECURRING 2: ~p",[T]),
                          doProcessLinkResponse(Req, Acs, T, undefined, undefined, Counter) ;
                 true  -> doRetrieve(Req, Uri, lists:reverse(Type), Counter+1)
             end
    end;

doProcessLinkResponse(Req, Acs, [_ | T], Uri, Type, Counter) ->
    %error_logger:warning_msg("RECURRING: ~p",[T]),
    %error_logger:warning_msg("RECURRING: URI ~p TYPE: ",[Uri, Type]),
    doProcessLinkResponse(Req, Acs, T, Uri, Type, Counter) .


doCheckAcceptType([], _) ->
    false;
doCheckAcceptType([H | T], Type) ->
    %error_logger:warning_msg("\n\n ACCEPT: :~p ~VS ~p ~n",[H, Type]),                                            
    case H of
        Type -> %error_logger:warning_msg("\n\n GREAT!!!!!!!!!!!!!!!",[]),
                true;
        _     -> doCheckAcceptType(T, Type)
    end.



    

%% Retrieval

retrieve(Req) ->
    inets:start(),
    case parseRequest(Req) of
        {error, _ } -> Req:respond(400, [], "");
        {ok, {Uri, Headers}} -> doRetrieve(Req, Uri, Headers, 0)
    end.        
    

doRetrieve(Req, Uri, Headers, Counter) ->
    case Counter < 2 of
        true ->
            error_logger:warning_msg("\n\n\n\n\n REQUESTING:: URI:~p ~n HEADERS:~p ~n",[Uri, Headers]),        
            case httpc:request(get, {Uri, [{"Accept", Headers}]}, [], []) of
                {ok,{{_, Status, _}, ResponseHeaders, Body}} -> 
                    error_logger:warning_msg("\n\n\n\n\n RESPONSE: STATUS:~p ~n HEADERS:~p ~n",[Status, ResponseHeaders]),                                            
                    case lists:keysearch("link",1,ResponseHeaders) of
                        false -> Req:respond({Status, validHeaders(ResponseHeaders), Body}) ;
                        {value, {_,LinkHeader}} -> 
                            case lists:keysearch("content-type", 1, ResponseHeaders) of
                                false -> case Counter of
                                             0  -> processLinkResponse(Req, Headers, LinkHeader,Counter);
                                             _  -> Req:respond({Status, validHeaders(ResponseHeaders), Body}) 
                                         end ;
                                {value, {_, ContentType}} ->
                                    case validContentType(ContentType, Headers) of
                                        true  -> error_logger:info_msg("~n~nRETURNING!!!~n~n",[]),
                                                 Req:respond({Status, validHeaders(ResponseHeaders), Body}) ;
                                        false ->  processLinkResponse(Req, Headers, LinkHeader,Counter)
                                    end
                            end
                    end;
                _  -> Req:respond(400, [], "")
            end ;
        false  ->
            Req:respond(400, [], "")
    end.


validContentType(ContentType, Headers) ->
    [CTH|_] = regexp_split_inclusive(ContentType,";\s*"),
    %error_logger:warning_msg("\n\n\n\n\n VALID CTNT REGEXP:  ~p  from ~p ~n",[CTH, ContentType]),                                            
    doValidContentType(CTH,regexp_split_inclusive(Headers,",\s*")).
doValidContentType(_ContentType, []) ->
    false;
doValidContentType(CTH, [H|T]) ->
    %error_logger:warning_msg("\n\n\n\n\n VALID HH REGEXP:  ~p  from ~p ~n",[H]),                                            
    case CTH of
        H -> true ;
        _  -> doValidContentType(CTH, T)
    end .
