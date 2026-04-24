var DHARMA_API = 'https://dharma-lake.vercel.app';

function onHomepage(e) {
  return buildWelcomeCard();
}

function onGmailMessage(e) {
  return buildMainCard(e.gmail.messageId);
}

function buildWelcomeCard() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Dharma')
      .setSubtitle('AI Email Assistant'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText('Open an email to generate a draft reply with AI.\n\nMake sure your account is connected at dharma-lake.vercel.app.'))
    )
    .build();
}

function buildMainCard(messageId) {
  var toneSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('tone')
    .setTitle('Tone')
    .addItem('Concise', 'Concise', true)
    .addItem('My Tone', 'My Tone', false)
    .addItem('Formal / Legal', 'Formal / Legal', false)
    .addItem('Casual / Friendly', 'Casual / Friendly', false);

  var draftBtn = CardService.newTextButton()
    .setText('Draft Reply')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(
      CardService.newAction()
        .setFunctionName('generateDraft')
        .setParameters({ messageId: messageId })
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Dharma'))
    .addSection(
      CardService.newCardSection()
        .addWidget(toneSelect)
        .addWidget(draftBtn)
    )
    .build();
}

function generateDraft(e) {
  var messageId = e.parameters.messageId;
  var tone = (e.formInput && e.formInput.tone) ? e.formInput.tone : 'Concise';
  var accessToken = ScriptApp.getOAuthToken();

  var message;
  try {
    message = Gmail.Users.Messages.get('me', messageId, { format: 'minimal' });
  } catch (err) {
    return notificationResponse('Could not read email: ' + err.message);
  }
  var threadId = message.threadId;

  var response;
  try {
    response = UrlFetchApp.fetch(DHARMA_API + '/api/emails/thread-draft', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      payload: JSON.stringify({ threadId: threadId, tone: tone }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    return notificationResponse('Network error: ' + err.message);
  }

  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    return notificationResponse('Bad response from server.');
  }

  if (!data.ok || !data.text) {
    var msg = data.error || 'Draft generation failed.';
    if (msg.indexOf('not connected') !== -1 || msg.indexOf('Account') !== -1) {
      msg = 'Account not connected to Dharma. Log in at dharma-lake.vercel.app first.';
    }
    return notificationResponse(msg);
  }

  // Store draft text in cache (expires in 10 min) — avoids 255-char action param limit
  var cacheKey = 'draft_' + Utilities.getUuid();
  CacheService.getUserCache().put(cacheKey, data.text, 600);

  var resultSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(data.text))
    .addWidget(
      CardService.newTextButton()
        .setText('Save as Draft in Gmail')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('saveDraft')
            .setParameters({ cacheKey: cacheKey, messageId: messageId })
        )
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Regenerate')
        .setOnClickAction(CardService.newAction().setFunctionName('popCard'))
    );

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(
        CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader().setTitle('Draft Reply'))
          .addSection(resultSection)
          .build()
      )
    )
    .build();
}

function saveDraft(e) {
  var cacheKey = e.parameters.cacheKey;
  var messageId = e.parameters.messageId;
  var text = CacheService.getUserCache().get(cacheKey);

  if (!text) {
    return notificationResponse('Draft expired — please generate again.');
  }

  var message = Gmail.Users.Messages.get('me', messageId, {
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID', 'References'],
  });

  var headers = message.payload.headers;
  var get = function (name) {
    var h = headers.filter(function (h) { return h.name.toLowerCase() === name.toLowerCase(); })[0];
    return h ? h.value : '';
  };

  var from = get('From');
  var subject = get('Subject') || '(no subject)';
  var replySubject = /^re:/i.test(subject) ? subject : 'Re: ' + subject;
  var msgId = get('Message-ID');
  var refs = get('References');
  var threadId = message.threadId;
  var userEmail = Session.getActiveUser().getEmail();

  var emailLines = [
    'From: ' + userEmail,
    'To: ' + from,
    'Subject: ' + replySubject,
    'Content-Type: text/plain; charset=utf-8',
  ];
  if (msgId) emailLines.push('In-Reply-To: ' + msgId);
  if (refs || msgId) emailLines.push('References: ' + ((refs ? refs + ' ' : '') + (msgId || '')).trim());
  var raw = emailLines.join('\r\n') + '\r\n\r\n' + text;
  var encoded = Utilities.base64EncodeWebSafe(raw);

  try {
    Gmail.Users.Drafts.create({ message: { raw: encoded, threadId: threadId } }, 'me');
  } catch (err) {
    return notificationResponse('Could not save draft: ' + err.message);
  }

  CacheService.getUserCache().remove(cacheKey);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Draft saved to Gmail!'))
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function popCard(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function notificationResponse(message) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(message))
    .build();
}
